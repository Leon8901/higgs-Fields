import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, providersTable, modelsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOwner } from "../middlewares/requireOwner";
import { tryGetAdapter } from "../lib/media/registry";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { importAssetFromUrl } from "../lib/media/assetImport";
import type { MediaAdapter } from "../lib/media/types";

const router: IRouter = Router();

// ── Simple in-memory cache for liveAvailableModels ───────────────────────────
// Populated only when a provider has a valid platform key and implements
// listAvailableModels. TTL: 5 minutes — avoids calling provider discovery
// endpoints on every admin page load while staying reasonably fresh.
const liveModelCache = new Map<string, { models: { id: string; name: string }[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function clearLiveCache(slug: string) {
  liveModelCache.delete(slug);
}

async function tryGetLiveModels(
  slug: string,
  adapter: MediaAdapter,
  apiKey: string,
): Promise<{ models: { id: string; name: string }[] | null; reason: string | null }> {
  if (!adapter.listAvailableModels) {
    return { models: null, reason: "Live catalog not available for this provider" };
  }

  const cached = liveModelCache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { models: cached.models, reason: null };
  }

  try {
    const models = await adapter.listAvailableModels(apiKey);
    liveModelCache.set(slug, { models, fetchedAt: Date.now() });
    return { models, reason: null };
  } catch (err) {
    return {
      models: null,
      reason: `Discovery call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function buildProviderResponse(
  p: typeof providersTable.$inferSelect,
  counts: { total: number; enabled: number },
  hasAdapter: boolean,
  live: { models: { id: string; name: string }[] | null; reason: string | null },
) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    icon: p.icon ?? null,
    capabilities: p.capabilities as string[],
    supportsByok: p.supportsByok,
    keyFormatHint: p.keyFormatHint ?? null,
    description: p.description ?? null,
    docsUrl: p.docsUrl ?? null,
    status: p.status,
    sortOrder: p.sortOrder,
    unavailableMessage: p.unavailableMessage ?? null,
    baseUrl: p.baseUrl ?? null,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    hasAdapter,
    platformEnabled: p.platformEnabled,
    platformKeyLastFour: p.platformKeyLastFour ?? null,
    platformKeyStatus: p.platformKeyStatus ?? null,
    platformKeyValidatedAt: p.platformKeyValidatedAt?.toISOString() ?? null,
    modelsCataloged: counts.total,
    modelsEnabled: counts.enabled,
    liveAvailableModels: live.models,
    liveAvailableModelsReason: live.reason,
  };
}

// ── GET /admin/providers ─────────────────────────────────────────────────────
// Every provider row with: catalog fields, hasAdapter, model counts,
// masked platform key info, and liveAvailableModels (cached, only for
// providers with a valid platform key and a listAvailableModels adapter).
router.get("/admin/providers", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const providers = await db
    .select()
    .from(providersTable)
    .orderBy(providersTable.sortOrder, providersTable.slug);

  // Real model counts — zero new work, the numbers are already in the DB
  const countRows = await db.execute(
    sql`SELECT adapter, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS enabled FROM models GROUP BY adapter`,
  );
  const modelCounts = new Map<string, { total: number; enabled: number }>();
  for (const row of countRows.rows as { adapter: string; total: number; enabled: number }[]) {
    modelCounts.set(row.adapter, { total: row.total, enabled: row.enabled });
  }

  const result = await Promise.all(
    providers.map(async (p) => {
      const adapter = tryGetAdapter(p.slug);
      const hasAdapter = !!adapter;
      const counts = modelCounts.get(p.slug) ?? { total: 0, enabled: 0 };

      let live: { models: { id: string; name: string }[] | null; reason: string | null } = {
        models: null,
        reason: null,
      };

      if (!hasAdapter || !adapter!.listAvailableModels) {
        live.reason = "Live catalog not available for this provider";
      } else if (!p.platformEnabled || !p.encryptedPlatformKey) {
        live.reason = "Add a valid platform key to see live available models";
      } else if (p.platformKeyStatus !== "valid") {
        live.reason = "Platform key must be verified (valid) before a discovery call is made";
      } else {
        try {
          const apiKey = decryptSecret(p.encryptedPlatformKey);
          live = await tryGetLiveModels(p.slug, adapter!, apiKey);
        } catch {
          live.reason = "Failed to decrypt platform key";
        }
      }

      return buildProviderResponse(p, counts, hasAdapter, live);
    }),
  );

  res.json(result);
});

// ── PATCH /admin/providers/:slug ─────────────────────────────────────────────
// Updates platformEnabled, baseUrl, metadata, sortOrder, status, description,
// docsUrl, keyFormatHint, unavailableMessage. Rejects platformEnabled: true
// for slugs without an adapter (with a clear explanation).
router.patch("/admin/providers/:slug", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ error: `Provider "${slug}" not found` });
    return;
  }

  const {
    platformEnabled,
    baseUrl,
    metadata,
    sortOrder,
    status,
    description,
    docsUrl,
    keyFormatHint,
    unavailableMessage,
    icon,
  } = req.body as Record<string, unknown>;

  // Reject enabling a provider with no adapter — it can't route requests
  if (platformEnabled === true && !tryGetAdapter(slug)) {
    res.status(400).json({
      error: `Cannot enable "${slug}" for platform routing: no code adapter is registered for this provider. A code adapter must be implemented in lib/media/registry.ts before platform routing can be enabled.`,
    });
    return;
  }

  const patch: Partial<typeof providersTable.$inferInsert> = {};
  if (typeof platformEnabled === "boolean") patch.platformEnabled = platformEnabled;
  if (typeof baseUrl === "string" || baseUrl === null) patch.baseUrl = baseUrl as string | null;
  if (metadata !== undefined && typeof metadata === "object") patch.metadata = metadata as Record<string, unknown>;
  if (typeof sortOrder === "number") patch.sortOrder = sortOrder;
  if (typeof status === "string" && (status === "active" || status === "disabled")) patch.status = status;
  if (typeof description === "string" || description === null) patch.description = description as string | null;
  if (typeof docsUrl === "string" || docsUrl === null) patch.docsUrl = docsUrl as string | null;
  if (typeof keyFormatHint === "string" || keyFormatHint === null) patch.keyFormatHint = keyFormatHint as string | null;
  if (typeof unavailableMessage === "string" || unavailableMessage === null) patch.unavailableMessage = unavailableMessage as string | null;
  if (typeof icon === "string" || icon === null) patch.icon = icon as string | null;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(providersTable)
    .set(patch)
    .where(eq(providersTable.slug, slug))
    .returning();

  const counts = await db.execute(
    sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS enabled FROM models WHERE adapter = ${slug}`,
  );
  const { total = 0, enabled = 0 } = (counts.rows[0] ?? {}) as { total?: number; enabled?: number };

  res.json(
    buildProviderResponse(updated, { total, enabled }, !!tryGetAdapter(slug), { models: null, reason: null }),
  );
});

// ── POST /admin/providers/:slug/platform-key ──────────────────────────────────
// Validates the key via adapter.validateKey if it exists, then encrypts and
// stores it. If validation is not supported, saves with status "unknown".
router.post("/admin/providers/:slug/platform-key", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ error: `Provider "${slug}" not found` });
    return;
  }

  const { apiKey } = req.body as { apiKey?: string };
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }

  const trimmedKey = apiKey.trim();
  const adapter = tryGetAdapter(slug);
  let status: "valid" | "invalid" | "unknown" = "unknown";

  if (adapter?.validateKey) {
    let isValid: boolean;
    try {
      isValid = await adapter.validateKey(trimmedKey);
    } catch (err) {
      req.log.error({ err, slug }, "Platform key validation call failed");
      res.status(502).json({
        error: "Could not verify this key with the provider right now. The key has NOT been saved — please try again.",
      });
      return;
    }
    if (!isValid) {
      res.status(400).json({
        error: "That API key was rejected by the provider. Please check it and try again. The key has NOT been saved.",
      });
      return;
    }
    status = "valid";
  }

  const encryptedPlatformKey = encryptSecret(trimmedKey);
  const platformKeyLastFour = trimmedKey.slice(-4);
  const platformKeyValidatedAt = status === "valid" ? new Date() : null;

  // Clear the live model cache so fresh numbers show up on the next load
  clearLiveCache(slug);

  const [updated] = await db
    .update(providersTable)
    .set({ encryptedPlatformKey, platformKeyLastFour, platformKeyStatus: status, platformKeyValidatedAt })
    .where(eq(providersTable.slug, slug))
    .returning();

  const counts = await db.execute(
    sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS enabled FROM models WHERE adapter = ${slug}`,
  );
  const { total = 0, enabled = 0 } = (counts.rows[0] ?? {}) as { total?: number; enabled?: number };

  res.json(
    buildProviderResponse(updated, { total, enabled }, !!adapter, { models: null, reason: null }),
  );
});

// ── DELETE /admin/providers/:slug/platform-key ────────────────────────────────
// Clears all key columns and forces platformEnabled = false.
router.delete("/admin/providers/:slug/platform-key", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ error: `Provider "${slug}" not found` });
    return;
  }

  clearLiveCache(slug);

  const [updated] = await db
    .update(providersTable)
    .set({
      encryptedPlatformKey: null,
      platformKeyLastFour: null,
      platformKeyStatus: null,
      platformKeyValidatedAt: null,
      platformEnabled: false,
    })
    .where(eq(providersTable.slug, slug))
    .returning();

  const counts = await db.execute(
    sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS enabled FROM models WHERE adapter = ${slug}`,
  );
  const { total = 0, enabled = 0 } = (counts.rows[0] ?? {}) as { total?: number; enabled?: number };

  res.json(
    buildProviderResponse(updated, { total, enabled }, !!tryGetAdapter(slug), { models: null, reason: null }),
  );
});

// ── POST /admin/providers/:slug/test-connection ───────────────────────────────
// Real pass/fail test using the stored platform key. Returns { testable: false }
// when the adapter has no validateKey — never fakes a green check.
router.post("/admin/providers/:slug/test-connection", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ error: `Provider "${slug}" not found` });
    return;
  }

  const adapter = tryGetAdapter(slug);
  if (!adapter) {
    res.json({ testable: false, reason: "No code adapter registered for this provider" });
    return;
  }
  if (!adapter.validateKey) {
    res.json({ testable: false, reason: "This adapter does not implement key validation" });
    return;
  }
  if (!provider.encryptedPlatformKey) {
    res.status(400).json({ error: "No platform key is saved for this provider" });
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(provider.encryptedPlatformKey);
  } catch {
    res.status(500).json({ error: "Platform key is stored but could not be decrypted. Try removing and re-adding it." });
    return;
  }

  let isValid: boolean;
  try {
    isValid = await adapter.validateKey(apiKey);
  } catch (err) {
    req.log.error({ err, slug }, "Test-connection validateKey call failed");
    res.json({
      testable: true,
      ok: false,
      message: `Validation call failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // Persist the result — keeps platformKeyStatus current after a manual test
  const newStatus: "valid" | "invalid" = isValid ? "valid" : "invalid";
  await db
    .update(providersTable)
    .set({ platformKeyStatus: newStatus, platformKeyValidatedAt: new Date() })
    .where(eq(providersTable.slug, slug));

  if (isValid) clearLiveCache(slug);

  res.json({
    testable: true,
    ok: isValid,
    message: isValid ? "Key is valid — connection successful" : "Key was rejected by the provider",
  });
});

// ── POST /admin/providers/:slug/icon ─────────────────────────────────────────
// Paste-URL path for provider icon images. Fetches, validates, re-hosts via
// the shared assetImport utility, and updates providers.icon.
// File uploads go through the presigned URL flow (POST /storage/upload-url) —
// the resulting owned path is then passed to PATCH /admin/providers/:slug.
router.post("/admin/providers/:slug/icon", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ error: `Provider "${slug}" not found` });
    return;
  }

  const { url } = req.body as { url?: string };
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let iconPath: string;
  try {
    iconPath = await importAssetFromUrl(url.trim());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Asset import failed" });
    return;
  }

  const [updated] = await db
    .update(providersTable)
    .set({ icon: iconPath })
    .where(eq(providersTable.slug, slug))
    .returning();

  const counts = await db.execute(
    sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS enabled FROM models WHERE adapter = ${slug}`,
  );
  const { total = 0, enabled = 0 } = (counts.rows[0] ?? {}) as { total?: number; enabled?: number };

  res.json(
    buildProviderResponse(updated, { total, enabled }, !!tryGetAdapter(slug), { models: null, reason: null }),
  );
});

export default router;
