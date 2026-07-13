import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable, type Model } from "@workspace/db";
import { decryptSecret } from "../crypto";

export interface KeyResolution {
  apiKey: string | undefined;
  usedOwnKey: boolean;
}

// Routing decision: "which API key services this generation?" — kept
// separate from billing (see ./pricing.ts) so the two can evolve
// independently. Only a *valid* (server-verified) saved key is eligible for
// BYOK routing; an "invalid" or still-"unknown" key silently falls back to
// the platform key rather than being handed to the provider and failing.
export async function resolveGenerationKey(
  userId: number,
  model: Pick<Model, "adapter">,
  useOwnKey: boolean | undefined,
): Promise<KeyResolution> {
  if (useOwnKey) {
    const [ownKey] = await db
      .select()
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.provider, model.adapter)));

    if (ownKey && ownKey.status === "valid") {
      await db.update(userApiKeysTable).set({ lastUsedAt: new Date() }).where(eq(userApiKeysTable.id, ownKey.id));
      return { apiKey: decryptSecret(ownKey.encryptedKey), usedOwnKey: true };
    }
  }

  return { apiKey: getPlatformApiKey(model.adapter), usedOwnKey: false };
}

// The platform's own provider key, used when a user isn't paying via BYOK.
// Only WaveSpeed is wired up today; add a case here as new adapters go live.
export function getPlatformApiKey(adapterSlug: string): string | undefined {
  switch (adapterSlug) {
    case "wavespeed":
      return process.env.WAVESPEED_API_KEY;
    default:
      return undefined;
  }
}
