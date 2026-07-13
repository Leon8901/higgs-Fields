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
//
// BYOK-only adapters (no platform subsidy — users must bring their own key):
//   openai      — OpenAI DALL·E image generation
//   kling       — Kling AI direct video generation
//   elevenlabs  — ElevenLabs text-to-speech
//
// For these, the default branch returns undefined, and resolveGenerationKey()
// propagates that undefined to the generation route, which returns 402 if no
// valid user-owned key is found. This is the intended UX: users see a prompt
// to add their own key in the "Add Your Keys" panel.
export function getPlatformApiKey(adapterSlug: string): string | undefined {
  switch (adapterSlug) {
    case "wavespeed":
      return process.env.WAVESPEED_API_KEY;
    // openai, kling, elevenlabs → BYOK-only, no platform key available.
    default:
      return undefined;
  }
}
