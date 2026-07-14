import { and, eq } from "drizzle-orm";
import {
  db,
  generationsTable,
  usersTable,
  userApiKeysTable,
  creditLedgerTable,
  type Generation,
  type Model,
} from "@workspace/db";
import { getAdapter } from "../media/registry";
import { ProviderError } from "../media/types";
import { decryptSecret } from "../crypto";
import { getPlatformApiKey } from "./keyRouting";
import { persistGeneratedAssets } from "../media/assetPersistence";

interface SyncLogger {
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

type FinalizeInput =
  | { status: "completed"; outputUrls: string[] }
  | { status: "failed"; errorMessage: string };

// ─────────────────────────────────────────────────────────────────────────────
// finalizeGeneration — the single completion function for all adapter types.
//
// Called from two places, which must converge here so completion bookkeeping
// is identical regardless of how the result arrived:
//
//   1. POST /api/generations (routes/generations.ts)
//      When submit() returns { kind: "completed" } (sync adapters — OpenAI,
//      ElevenLabs). Called immediately, before returning the 201 response.
//
//   2. syncGenerationStatus (below)
//      When poll() reports "completed" or "failed" (async adapters — WaveSpeed,
//      Kling). Called from the background poller and the on-demand GET handler.
//
// Steps performed for every terminal result (completed or failed):
//   • Persist output assets through the standard asset-persistence path.
//   • Write final status, output URLs, errorMessage, and completedAt to the DB.
//   • Refund credits on any failure so a generation that never delivers a
//     permanent result never costs the user.
// ─────────────────────────────────────────────────────────────────────────────
export async function finalizeGeneration(
  generation: Generation,
  input: FinalizeInput,
  log: SyncLogger,
): Promise<Generation> {
  let finalStatus: "completed" | "failed";
  let outputUrls: string[];
  let errorMessage: string | null;

  if (input.status === "completed") {
    try {
      // Re-host provider-returned URLs on our own storage so they don't expire
      // when the provider's retention window ends. This helper is idempotent:
      // paths that already start with "/api/storage/" (e.g. audio that the
      // ElevenLabs adapter uploaded in submit()) pass through unchanged.
      outputUrls = await persistGeneratedAssets(input.outputUrls);
      finalStatus = "completed";
      errorMessage = null;
    } catch (err) {
      log.error(
        { err, generationId: generation.id },
        "Failed to persist generated asset to permanent storage",
      );
      // Persistence failure is treated as a generation failure so credits are
      // refunded — a generation with a broken output URL is worse than no
      // generation at all.
      finalStatus = "failed";
      outputUrls = [];
      errorMessage = "Your generation finished but we couldn't save the result. Please try again.";
    }
  } else {
    // Provider reported failure — no assets to persist.
    finalStatus = "failed";
    outputUrls = [];
    errorMessage = input.errorMessage;
  }

  const [updated] = await db
    .update(generationsTable)
    .set({
      status: finalStatus,
      outputUrls,
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(generationsTable.id, generation.id))
    .returning();

  // Refund credits on any failure (provider-side failure or our own storage
  // failure) so a generation that never delivers a permanent result is free.
  if (finalStatus === "failed" && updated.creditsCharged > 0) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, generation.userId));
    if (user) {
      const newBalance = user.creditsBalance + updated.creditsCharged;
      await db.update(usersTable).set({ creditsBalance: newBalance }).where(eq(usersTable.id, user.id));
      await db.insert(creditLedgerTable).values({
        userId: user.id,
        delta: updated.creditsCharged,
        reason: "refund",
        balanceAfter: newBalance,
        generationId: updated.id,
      });
    }
  }

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// syncGenerationStatus — drives async adapter polling.
//
// Single source of truth for "is this async generation done, and is its
// result saved permanently?" — shared by:
//   • GET /api/generations/:id (on-demand sync for a snappy UI while the tab
//     is open)
//   • backgroundPoller.ts (server-side, fires even if every browser tab closes)
//
// Sync adapters (OpenAI, ElevenLabs) never reach this function: their
// generations have no providerTaskId, so the early-return guard fires
// immediately. All completion work for sync adapters happens in
// finalizeGeneration(), called directly from the POST /api/generations handler.
// ─────────────────────────────────────────────────────────────────────────────
export async function syncGenerationStatus(
  generation: Generation,
  model: Model,
  log: SyncLogger,
): Promise<Generation> {
  // Only async, in-flight generations with a real provider task ID need polling.
  if (
    !(generation.status === "pending" || generation.status === "processing") ||
    !generation.providerTaskId
  ) {
    return generation;
  }

  try {
    const apiKey = generation.usedOwnKey
      ? await (async () => {
          const [ownKey] = await db
            .select()
            .from(userApiKeysTable)
            .where(and(eq(userApiKeysTable.userId, generation.userId), eq(userApiKeysTable.provider, model.adapter)));
          return ownKey ? decryptSecret(ownKey.encryptedKey) : getPlatformApiKey(model.adapter);
        })()
      : getPlatformApiKey(model.adapter);

    if (!apiKey) return generation;

    const adapter = getAdapter(model.adapter);

    // Safety guard: a sync adapter (no poll()) should never reach this code
    // because its generations have providerTaskId = null. If this fires, the
    // generation insert logic has a bug — log it and bail rather than crashing
    // the background poller.
    if (!adapter.poll) {
      log.error(
        { adapter: model.adapter, generationId: generation.id },
        "syncGenerationStatus reached a sync adapter (poll() not defined) — providerTaskId should be null for sync adapters; this is a bug in the generation insert path",
      );
      return generation;
    }

    const polled = await adapter.poll(generation.providerTaskId, apiKey);

    // Still in-flight — update status if it changed (e.g. pending → processing),
    // but do not call finalizeGeneration yet.
    if (polled.status === "pending" || polled.status === "processing") {
      if (polled.status === generation.status) return generation;
      const [updated] = await db
        .update(generationsTable)
        .set({ status: polled.status })
        .where(eq(generationsTable.id, generation.id))
        .returning();
      return updated;
    }

    // Terminal state — hand off to finalizeGeneration. This is the same function
    // the POST handler calls for sync adapters, so both paths share identical
    // completion bookkeeping: asset persistence, DB write, credit refund.
    return finalizeGeneration(
      generation,
      polled.status === "completed"
        ? { status: "completed", outputUrls: polled.outputUrls }
        : { status: "failed", errorMessage: polled.errorMessage ?? "Generation failed" },
      log,
    );
  } catch (err) {
    if (err instanceof ProviderError) {
      log.error(
        { adapter: model.adapter, modelId: model.modelId, kind: err.kind, providerMessage: err.providerMessage },
        "Provider poll failed",
      );
    } else {
      log.error({ err, generationId: generation.id }, "Provider poll failed (unexpected error shape)");
    }
    // Swallowed intentionally: this is a background status check. The generation
    // stays in its current status and we retry on the next poller tick rather
    // than surfacing a transient poll error to the user.
    return generation;
  }
}
