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

// Single source of truth for "is this generation actually done, and is its
// result saved permanently?" — shared by the on-demand poll in
// GET /api/generations/:id (for a snappy UI while the tab is open) and the
// server-side background poller (backgroundPoller.ts), which is what makes
// completion independent of the browser staying open. Both call sites must
// stay behaviorally identical, so this is the only place that talks to the
// provider adapter and writes a completed/failed status.
export async function syncGenerationStatus(
  generation: Generation,
  model: Model,
  log: SyncLogger,
): Promise<Generation> {
  if (!(generation.status === "pending" || generation.status === "processing") || !generation.providerTaskId) {
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
    const polled = await adapter.poll(generation.providerTaskId, apiKey);

    if (polled.status === generation.status) {
      return generation;
    }

    let finalStatus = polled.status;
    let outputUrls = polled.outputUrls;
    let errorMessage = polled.errorMessage ?? null;

    // Only ever mark "completed" once the asset is safely re-hosted on our
    // own storage — WaveSpeed's URLs are temporary, so saving them as-is
    // would silently rot once the provider's retention window passes. If
    // re-hosting fails, the generation is treated as failed (and refunded
    // below) rather than "completed" with a link that will later break.
    if (polled.status === "completed") {
      try {
        outputUrls = await persistGeneratedAssets(polled.outputUrls);
      } catch (err) {
        log.error(
          { err, generationId: generation.id, modelId: model.modelId },
          "Failed to persist generated asset to permanent storage",
        );
        finalStatus = "failed";
        outputUrls = [];
        errorMessage = "Your generation finished but we couldn't save the result. Please try again.";
      }
    }

    const [updated] = await db
      .update(generationsTable)
      .set({
        status: finalStatus,
        outputUrls,
        errorMessage,
        completedAt: finalStatus === "completed" || finalStatus === "failed" ? new Date() : null,
      })
      .where(eq(generationsTable.id, generation.id))
      .returning();

    // Refund credits on any failure path (provider-side failure, or our own
    // storage re-hosting failure) so a generation that never delivers a
    // permanent result never costs the user.
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
  } catch (err) {
    if (err instanceof ProviderError) {
      log.error(
        { adapter: model.adapter, modelId: model.modelId, kind: err.kind, providerMessage: err.providerMessage },
        "Provider poll failed",
      );
    } else {
      log.error({ err, generationId: generation.id }, "Provider poll failed (unexpected error shape)");
    }
    // Swallowed intentionally: this is a background status check. The
    // generation just stays in its current status and we retry on the next
    // poll rather than surfacing a transient poll error.
    return generation;
  }
}
