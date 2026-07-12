import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Derives a stable 256-bit AES key from SESSION_SECRET via SHA-256 (a simple
// HKDF-style derivation with a fixed context label so the key is never reused
// verbatim for anything else). This avoids provisioning a brand-new secret
// just for encrypting user-provided (BYOK) provider API keys at rest.
function deriveKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set to encrypt/decrypt BYOK keys.");
  }
  return createHash("sha256").update(`byok-api-key-encryption:${secret}`).digest();
}

const ALGORITHM = "aes-256-gcm";

// Returns "iv:authTag:ciphertext", all hex-encoded, so it can be stored as a
// single text column.
export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted secret.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
