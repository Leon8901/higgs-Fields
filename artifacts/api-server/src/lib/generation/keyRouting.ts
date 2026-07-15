import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable, type Model } from "@workspace/db";
import { decryptSecret } from "../crypto";
import { isPlatformGenerationEnabled } from "../settings";

export interface KeyResolution {
  apiKey: string | undefined;
  usedOwnKey: boolean;
  // Set when the request must be rejected outright (platform generation is
  // disabled and no valid BYOK key was available) rather than silently
  // falling back to an undefined platform key.
  rejected?: { reason: string };
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

  // Falling through to the platform key — the owner's kill switch applies
  // only here, never to a genuine BYOK request above.
  if (!(await isPlatformGenerationEnabled())) {
    return {
      apiKey: undefined,
      usedOwnKey: false,
      rejected: { reason: "Platform-provided generation is temporarily disabled. Add your own API key to keep generating." },
    };
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
