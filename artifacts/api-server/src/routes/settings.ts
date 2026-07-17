import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { GetPublicSettingsResponse, GetAdminSettingsResponse, UpdateAdminSettingsBody, UpdateAdminSettingsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOwner } from "../middlewares/requireOwner";
import { getPublicSettings, getAdminSettings, updateSettings } from "../lib/settings";
import { db, siteSettingsTable, settingsMetaTable, generationsTable } from "@workspace/db";
import { SETTINGS_REGISTRY } from "@workspace/db/settingsRegistry";
import { importAssetFromUrl } from "../lib/media/assetImport";

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

/** Real functional probe of the sidecar signing step — the actual step that fails in production.
 *  Does NOT write any object to storage; it only asks for a signed URL.
 *  Returns a three-state result:
 *    connected    — a signed URL came back (storage is working)
 *    disconnected — sidecar responded with a confirmed HTTP error (4xx/5xx)
 *    warning      — could not reach a conclusive answer (timeout, DNS failure, etc.)
 */
async function probeObjectStorage(): Promise<{
  status: 'connected' | 'disconnected' | 'warning';
  message?: string;
}> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    return { status: 'disconnected', message: 'PRIVATE_OBJECT_DIR is not set — create a bucket in Object Storage and set the env var.' };
  }

  const bucketAndPath = privateObjectDir.replace(/^gs:\/\//, '');
  const [bucketName, ...rest] = bucketAndPath.split('/');
  const prefix = rest.length ? rest.join('/') : '';
  const objectName = `${prefix ? prefix + '/' : ''}__health_probe_do_not_use`;

  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method: 'PUT',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };

  try {
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (response.ok) {
      return { status: 'connected' };
    }

    // Confirmed HTTP error from the sidecar — we know exactly what went wrong
    let detail = `errorcode: ${response.status}`;
    try {
      const body = await response.text();
      if (body) detail = body;
    } catch { /* ignore body parse failure */ }
    return {
      status: 'disconnected',
      message: `Failed to sign object URL, ${detail}, make sure you're running on Replit`,
    };
  } catch (err) {
    // Timeout, connection refused, DNS failure — couldn't get a conclusive answer
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'warning', message };
  }
}

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getPublicSettings();
  res.json(GetPublicSettingsResponse.parse(settings));
});

router.get("/admin/settings", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const settings = await getAdminSettings();
  res.json(GetAdminSettingsResponse.parse(settings));
});

router.patch("/admin/settings", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const result = await updateSettings(body.data);
  if (!result.ok) {
    res.status(400).json({ error: "Validation failed", fields: result.errors });
    return;
  }

  const settings = await getAdminSettings();
  res.json(UpdateAdminSettingsResponse.parse(settings));
});

// Shared asset-import endpoint — fetches an external URL server-side,
// validates it's a real image under 5 MB, re-hosts it on our own storage,
// and returns the owned path. Used by the Logos & Icons branding tab and
// provider icon management so raw external URLs never reach the DB directly.
router.post("/admin/settings/import-asset", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  try {
    const path = await importAssetFromUrl(url.trim());
    res.json({ path });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Asset import failed" });
  }
});

// Export all settings as a flat key→value JSON file download.
router.get("/admin/settings/export", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const settings = await getAdminSettings();
  const flat: Record<string, unknown> = {};
  for (const s of settings) flat[s.key] = s.value;
  const date = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Disposition", `attachment; filename="site-settings-${date}.json"`);
  res.json(flat);
});

// Import settings from a flat key→value object — same all-or-nothing semantics as PATCH.
// Unknown keys are rejected by updateSettings() which checks against SETTINGS_BY_KEY.
router.post("/admin/settings/import", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Body must be a flat JSON object" });
    return;
  }
  const result = await updateSettings(body as Record<string, unknown>);
  if (!result.ok) {
    res.status(400).json({ error: "Validation failed", fields: result.errors });
    return;
  }
  const settings = await getAdminSettings();
  res.json(GetAdminSettingsResponse.parse(settings));
});

// Reset every setting to its registry default — one updateSettings() call, same validation path.
router.post("/admin/settings/reset-defaults", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const patch: Record<string, unknown> = {};
  for (const def of SETTINGS_REGISTRY) patch[def.key] = def.default;
  const result = await updateSettings(patch);
  if (!result.ok) {
    res.status(500).json({ error: "Reset failed", fields: result.errors });
    return;
  }
  const settings = await getAdminSettings();
  res.json(GetAdminSettingsResponse.parse(settings));
});

// Real infrastructure health checks for the admin settings panel.
// Database: runs a real query against settings_meta.
// Object Storage: real functional sidecar signing probe — three states:
//   connected / disconnected (confirmed error) / warning (couldn't determine).
// providerHostedCount: rows in generations with is_provider_hosted = true.
// lastSavedAt: MAX(updated_at) across all site_settings rows.
router.get("/admin/settings/health", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  // Run all checks concurrently
  const [dbResult, storageResult, providerHostedResult, lastSavedAtResult] = await Promise.allSettled([
    db.select().from(settingsMetaTable).where(eq(settingsMetaTable.id, 1)),
    probeObjectStorage(),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(generationsTable).where(eq(generationsTable.isProviderHosted, true)),
    db.select({ maxUpdatedAt: sql<string>`MAX(updated_at)` }).from(siteSettingsTable),
  ]);

  const dbConnected = dbResult.status === 'fulfilled';

  const storage = storageResult.status === 'fulfilled'
    ? storageResult.value
    : { status: 'warning' as const, message: storageResult.reason instanceof Error ? storageResult.reason.message : String(storageResult.reason) };

  const providerHostedCount = providerHostedResult.status === 'fulfilled'
    ? (providerHostedResult.value[0]?.count ?? 0)
    : 0;

  const lastSavedAt = lastSavedAtResult.status === 'fulfilled'
    ? (lastSavedAtResult.value[0]?.maxUpdatedAt ?? null)
    : null;

  res.json({
    database: { connected: dbConnected },
    objectStorage: {
      status: storage.status,
      message: storage.message ?? null,
      providerHostedCount,
    },
    lastSavedAt,
  });
});

export default router;
