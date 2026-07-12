import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, generationsTable, modelsTable, usersTable, creditLedgerTable, userApiKeysTable, type Model } from "@workspace/db";
import {
  CreateGenerationBody,
  CreateGenerationResponse,
  ListGenerationsResponse,
  GetGenerationParams,
  GetGenerationResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getAdapter } from "../lib/media/registry";
import { enhancePrompt, autoSelectModel } from "../lib/llm/planner";
import { decryptSecret } from "../lib/crypto";

const router: IRouter = Router();

function toGenerationResponse(row: typeof generationsTable.$inferSelect, model: Model) {
  return {
    id: row.id,
    modelId: model.modelId,
    modelName: model.name,
    category: model.category,
    prompt: row.prompt,
    params: row.params,
    status: row.status,
    outputType: row.outputType,
    outputUrls: row.outputUrls,
    creditsCharged: row.creditsCharged,
    usedOwnKey: row.usedOwnKey,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

router.get("/generations", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(generationsTable)
    .innerJoin(modelsTable, eq(generationsTable.modelId, modelsTable.id))
    .where(eq(generationsTable.userId, req.appUser!.id))
    .orderBy(desc(generationsTable.createdAt));

  const results = rows.map((r) => toGenerationResponse(r.generations, r.models));
  res.json(ListGenerationsResponse.parse(results));
});

router.post("/generations", requireAuth, async (req, res): Promise<void> => {
  const body = CreateGenerationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { modelId, prompt, params, autoSelect, useOwnKey, skipEnhance } = body.data;

  const allModels = await db.select().from(modelsTable);
  if (allModels.length === 0) {
    res.status(400).json({ error: "No models are configured." });
    return;
  }

  let model: Model | undefined;
  if (autoSelect || !modelId) {
    try {
      const picked = await autoSelectModel(prompt, allModels);
      model = allModels.find((m) => m.modelId === picked.modelId);
    } catch (err) {
      req.log.error({ err }, "Auto model selection failed");
      res.status(400).json({ error: "Could not auto-select a model. Please choose one explicitly." });
      return;
    }
  } else {
    model = allModels.find((m) => m.modelId === modelId);
  }

  if (!model) {
    res.status(400).json({ error: "Unknown model." });
    return;
  }

  const user = req.appUser!;

  // Resolve which provider key to use: the user's own BYOK key (if requested
  // and configured) bypasses the platform credit charge since they're paying
  // the provider directly; otherwise fall back to the platform's key.
  let apiKey: string | undefined;
  let usedOwnKey = false;
  if (useOwnKey) {
    const [ownKey] = await db
      .select()
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, user.id), eq(userApiKeysTable.provider, model.adapter)));
    if (ownKey) {
      apiKey = decryptSecret(ownKey.encryptedKey);
      usedOwnKey = true;
      await db.update(userApiKeysTable).set({ lastUsedAt: new Date() }).where(eq(userApiKeysTable.id, ownKey.id));
    }
  }

  if (!usedOwnKey) {
    if (user.creditsBalance < model.creditCost) {
      res.status(402).json({ error: "Insufficient credits. Upgrade your plan or add your own API key." });
      return;
    }
    apiKey = process.env.WAVESPEED_API_KEY;
  }

  if (!apiKey) {
    res.status(500).json({ error: "No API key available to submit this generation." });
    return;
  }

  const finalPrompt = skipEnhance ? prompt : await enhancePrompt(prompt, model.category);
  const providerParams = { prompt: finalPrompt, ...(params ?? {}) };

  const adapter = getAdapter(model.adapter);
  let providerTaskId: string;
  try {
    const submitted = await adapter.submit(model.providerModelPath, providerParams, apiKey);
    providerTaskId = submitted.providerTaskId;
  } catch (err) {
    req.log.error({ err }, "Provider submit failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to submit generation to provider." });
    return;
  }

  const creditsCharged = usedOwnKey ? 0 : model.creditCost;

  const [generation] = await db
    .insert(generationsTable)
    .values({
      userId: user.id,
      modelId: model.id,
      prompt: finalPrompt,
      params: providerParams,
      status: "processing",
      outputType: model.category,
      outputUrls: [],
      creditsCharged,
      usedOwnKey,
      providerTaskId,
    })
    .returning();

  if (creditsCharged > 0) {
    const newBalance = user.creditsBalance - creditsCharged;
    await db.update(usersTable).set({ creditsBalance: newBalance }).where(eq(usersTable.id, user.id));
    await db.insert(creditLedgerTable).values({
      userId: user.id,
      delta: -creditsCharged,
      reason: "generation",
      balanceAfter: newBalance,
      generationId: generation.id,
    });
  }

  res.status(201).json(CreateGenerationResponse.parse(toGenerationResponse(generation, model)));
});

router.get("/generations/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(generationsTable)
    .innerJoin(modelsTable, eq(generationsTable.modelId, modelsTable.id))
    .where(and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.appUser!.id)));

  if (!row) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  let generation = row.generations;
  const model = row.models;

  if ((generation.status === "pending" || generation.status === "processing") && generation.providerTaskId) {
    try {
      const apiKey = generation.usedOwnKey
        ? await (async () => {
            const [ownKey] = await db
              .select()
              .from(userApiKeysTable)
              .where(and(eq(userApiKeysTable.userId, req.appUser!.id), eq(userApiKeysTable.provider, model.adapter)));
            return ownKey ? decryptSecret(ownKey.encryptedKey) : process.env.WAVESPEED_API_KEY;
          })()
        : process.env.WAVESPEED_API_KEY;

      if (apiKey) {
        const adapter = getAdapter(model.adapter);
        const polled = await adapter.poll(generation.providerTaskId, apiKey);

        if (polled.status !== generation.status) {
          const [updated] = await db
            .update(generationsTable)
            .set({
              status: polled.status,
              outputUrls: polled.outputUrls,
              errorMessage: polled.errorMessage ?? null,
              completedAt: polled.status === "completed" || polled.status === "failed" ? new Date() : null,
            })
            .where(eq(generationsTable.id, generation.id))
            .returning();
          generation = updated;

          // Refund credits on provider-side failure so a failed job never costs the user.
          if (polled.status === "failed" && generation.creditsCharged > 0) {
            const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.appUser!.id));
            if (user) {
              const newBalance = user.creditsBalance + generation.creditsCharged;
              await db.update(usersTable).set({ creditsBalance: newBalance }).where(eq(usersTable.id, user.id));
              await db.insert(creditLedgerTable).values({
                userId: user.id,
                delta: generation.creditsCharged,
                reason: "refund",
                balanceAfter: newBalance,
                generationId: generation.id,
              });
            }
          }
        }
      }
    } catch (err) {
      req.log.error({ err }, "Provider poll failed");
    }
  }

  res.json(GetGenerationResponse.parse(toGenerationResponse(generation, model)));
});

export default router;
