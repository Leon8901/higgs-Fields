import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { ListApiKeysResponse, UpsertApiKeyBody, UpsertApiKeyResponse, DeleteApiKeyParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { encryptSecret } from "../lib/crypto";

const router: IRouter = Router();

router.get("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const keys = await db
    .select({
      provider: userApiKeysTable.provider,
      lastFour: userApiKeysTable.lastFour,
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
  const encryptedKey = encryptSecret(apiKey);
  const lastFour = apiKey.slice(-4);
  const userId = req.appUser!.id;

  const [existing] = await db
    .select()
    .from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.provider, provider)));

  const [saved] = existing
    ? await db
        .update(userApiKeysTable)
        .set({ encryptedKey, lastFour })
        .where(eq(userApiKeysTable.id, existing.id))
        .returning()
    : await db.insert(userApiKeysTable).values({ userId, provider, encryptedKey, lastFour }).returning();

  res.json(
    UpsertApiKeyResponse.parse({
      provider: saved.provider,
      lastFour: saved.lastFour,
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
