import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable, providersTable } from "@workspace/db";
import { ListApiKeysResponse, UpsertApiKeyBody, UpsertApiKeyResponse, DeleteApiKeyParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { encryptSecret } from "../lib/crypto";
import { tryGetAdapter } from "../lib/media/registry";

const router: IRouter = Router();

router.get("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const keys = await db
    .select({
      provider: userApiKeysTable.provider,
      lastFour: userApiKeysTable.lastFour,
      status: userApiKeysTable.status,
      validatedAt: userApiKeysTable.validatedAt,
      createdAt: userApiKeysTable.createdAt,
      lastUsedAt: userApiKeysTable.lastUsedAt,
    })
    .from(userApiKeysTable)
    .where(eq(userApiKeysTable.userId, req.appUser!.id));

  res.json(ListApiKeysResponse.parse(keys));
});

router.post("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const body = UpsertApiKeyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { provider, apiKey } = body.data;

  const [providerRow] = await db.select().from(providersTable).where(eq(providersTable.slug, provider));
  if (!providerRow || !providerRow.supportsByok) {
    res.status(400).json({ error: "Unsupported provider." });
    return;
  }
  if (providerRow.status !== "active") {
    res.status(400).json({
      error:
        providerRow.unavailableMessage ??
        "This provider is temporarily unavailable and will be available soon — you can use another provider in the meantime.",
    });
    return;
  }

  // Validate the key against the real provider before ever persisting it —
  // an invalid key is never saved. If the provider doesn't have a code
  // adapter yet (or the adapter can't check keys), we can't confirm either
  // way, so we save it with status "unknown" rather than blocking the user.
  let status: "valid" | "invalid" | "unknown" = "unknown";
  const adapter = tryGetAdapter(provider);
  if (adapter?.validateKey) {
    let isValid: boolean;
    try {
      isValid = await adapter.validateKey(apiKey);
    } catch (err) {
      req.log.error({ err, provider }, "Provider key validation call failed");
      res.status(502).json({ error: "Could not verify this key with the provider right now. Please try again." });
      return;
    }
    if (!isValid) {
      res.status(400).json({ error: "That API key was rejected by the provider. Please check it and try again." });
      return;
    }
    status = "valid";
  }

  const encryptedKey = encryptSecret(apiKey);
  const lastFour = apiKey.slice(-4);
  const userId = req.appUser!.id;
  const validatedAt = status === "unknown" ? null : new Date();

  const [existing] = await db
    .select()
    .from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.provider, provider)));

  const [saved] = existing
    ? await db
        .update(userApiKeysTable)
        .set({ encryptedKey, lastFour, status, validatedAt })
        .where(eq(userApiKeysTable.id, existing.id))
        .returning()
    : await db.insert(userApiKeysTable).values({ userId, provider, encryptedKey, lastFour, status, validatedAt }).returning();

  res.json(
    UpsertApiKeyResponse.parse({
      provider: saved.provider,
      lastFour: saved.lastFour,
      status: saved.status,
      validatedAt: saved.validatedAt,
      createdAt: saved.createdAt,
      lastUsedAt: saved.lastUsedAt,
    }),
  );
});

router.delete("/api-keys/:provider", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteApiKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const deleted = await db
    .delete(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, req.appUser!.id), eq(userApiKeysTable.provider, params.data.provider)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.status(204).end();
});

export default router;
