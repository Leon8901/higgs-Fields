import { Router, type IRouter } from "express";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, modelsTable, providersTable, userApiKeysTable } from "@workspace/db";
import { ListProvidersResponse, ListProviderVoicesResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { decryptSecret } from "../lib/crypto";
import { tryGetAdapter } from "../lib/media/registry";
import { ProviderError } from "../lib/media/types";

const router: IRouter = Router();

// Data-driven BYOK provider catalog: the union of (a) providers actually
// referenced by a model in the catalog today, and (b) providers that support
// BYOK independent of any specific model. Adding a row to the `providers`
// table is enough to make it appear in the frontend's "Add Your Keys" panel —
// no frontend code changes needed. Disabled providers never appear.
router.get("/providers", async (req, res): Promise<void> => {
  const models = await db.select({ adapter: modelsTable.adapter }).from(modelsTable);
  const adaptersInUse = [...new Set(models.map((m) => m.adapter))];

  const rows = await db
    .select()
    .from(providersTable)
    .where(
      adaptersInUse.length > 0
        ? or(inArray(providersTable.slug, adaptersInUse), eq(providersTable.supportsByok, true))
        : eq(providersTable.supportsByok, true),
    );

  const providers = rows
    .filter((p) => p.status === "active")
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      icon: p.icon,
      capabilities: p.capabilities as string[],
      supportsByok: p.supportsByok,
      keyFormatHint: p.keyFormatHint,
      description: p.description ?? null,
      docsUrl: p.docsUrl ?? null,
    }));

  const missing = adaptersInUse.filter((slug) => !rows.some((p) => p.slug === slug));
  if (missing.length > 0) {
    req.log.warn({ missing }, "Model catalog references adapters with no matching providers row");
  }

  res.json(ListProvidersResponse.parse(providers));
});

// Live, account-specific voice catalog for voice-capable providers (today:
// ElevenLabs). Deliberately requires the caller's own *valid* connected key —
// there is no platform key to fall back to, and no hardcoded voice list would
// be correct for every account (premade-voice API access and cloned voices
// both vary by account/plan). See elevenlabs.ts listVoices() for the "why".
router.get("/providers/:slug/voices", requireAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug);

  const adapter = tryGetAdapter(slug);
  if (!adapter?.listVoices) {
    res.status(400).json({ error: "This provider does not have a voice catalog." });
    return;
  }

  const [ownKey] = await db
    .select()
    .from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, req.appUser!.id), eq(userApiKeysTable.provider, slug)));

  if (!ownKey || ownKey.status !== "valid") {
    res.status(400).json({ error: "Connect a valid API key for this provider first." });
    return;
  }

  try {
    const voices = await adapter.listVoices(decryptSecret(ownKey.encryptedKey));
    res.json(ListProviderVoicesResponse.parse(voices));
  } catch (err) {
    if (err instanceof ProviderError) {
      req.log.error({ err, provider: slug }, "Provider voice list failed");
      // This route only ever uses the caller's own BYOK key — there is no
      // platform key to protect — so the provider's own message is always
      // safe and actionable here (e.g. a restricted ElevenLabs key missing
      // the `voices_read` scope). Surfacing it lets the user actually fix
      // their key/account instead of just retrying a call that will fail
      // the same way every time.
      res.status(502).json({ error: err.providerMessage });
      return;
    }
    throw err;
  }
});

export default router;
