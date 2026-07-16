import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { GetPublicSettingsResponse, GetAdminSettingsResponse, UpdateAdminSettingsBody, UpdateAdminSettingsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOwner } from "../middlewares/requireOwner";
import { getPublicSettings, getAdminSettings, updateSettings } from "../lib/settings";
import { db, siteSettingsTable, settingsMetaTable } from "@workspace/db";
import { SETTINGS_REGISTRY } from "@workspace/db/settingsRegistry";

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
// Database: runs a real query against settings_meta (always has exactly one row).
// Object Storage: checks that the required env vars are present — an honest
//   signal without a live round-trip, per the spec requirement.
// lastSavedAt: MAX(updated_at) across all site_settings rows.
router.get("/admin/settings/health", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  let dbConnected = true;
  try {
    await db.select().from(settingsMetaTable).where(eq(settingsMetaTable.id, 1));
  } catch {
    dbConnected = false;
  }

  const storageConnected = Boolean(
    process.env.PRIVATE_OBJECT_DIR && process.env.PUBLIC_OBJECT_SEARCH_PATHS,
  );

  let lastSavedAt: string | null = null;
  try {
    const [row] = await db
      .select({ maxUpdatedAt: sql<string>`MAX(updated_at)` })
      .from(siteSettingsTable);
    lastSavedAt = row?.maxUpdatedAt ?? null;
  } catch {
    // DB may be unavailable; lastSavedAt stays null — the caller handles it
  }

  res.json({
    database: { connected: dbConnected },
    objectStorage: { connected: storageConnected },
    lastSavedAt,
  });
});

export default router;
