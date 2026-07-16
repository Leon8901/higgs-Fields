import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable, providersTable, type Model } from "@workspace/db";
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

  return { apiKey: await getPlatformApiKey(model.adapter), usedOwnKey: false };
}

// The platform's own provider key — now a real async DB lookup instead of a
// hardcoded switch. Reads `platform_enabled` + `encrypted_platform_key` from
// the providers table and decrypts via lib/crypto.ts. This is the change that
// makes the admin "manage any provider's key" UI real: previously a switch
// statement could only ever surface WAVESPEED_API_KEY; now any provider the
// owner enables in the admin panel is routed automatically.
//
// Degrades gracefully: if no row has platformEnabled=true for this slug, or
// decryption fails (malformed ciphertext), returns undefined. The generation
// route propagates that undefined to a 402 response — the same UX as before
// for adapters that have no platform key configured.
export async function getPlatformApiKey(adapterSlug: string): Promise<string | undefined> {
  const [provider] = await db
    .select({
      encryptedPlatformKey: providersTable.encryptedPlatformKey,
      platformEnabled: providersTable.platformEnabled,
    })
    .from(providersTable)
    .where(and(eq(providersTable.slug, adapterSlug), eq(providersTable.platformEnabled, true)));

  if (!provider?.encryptedPlatformKey) return undefined;

  try {
    return decryptSecret(provider.encryptedPlatformKey);
  } catch {
    // Malformed encrypted key — silently degrade rather than crashing the
    // generation request. The platform key goes missing for this request; the
    // generation route returns 402 rather than 500.
    return undefined;
  }
}
