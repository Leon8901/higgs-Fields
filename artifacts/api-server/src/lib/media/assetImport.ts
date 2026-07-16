import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";

// Image MIME types we accept for re-hosting. SVG is included because it's a
// common logo format, but note it's text/XML — we validate it server-side just
// like any other type (Content-Type must match).
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const objectStorageService = new ObjectStorageService();

/**
 * Shared asset-import utility — written once, called from:
 *   • Logos & Icons (branding admin page, logo_url / favicon_url)
 *   • Provider icon upload (Platform Providers + BYOK Providers admin pages)
 *
 * Given any http(s) URL this function:
 *   1. Validates it's a real http/https URL.
 *   2. Fetches with a 15-second timeout, following redirects.
 *   3. Verifies Content-Type is a supported image type.
 *   4. Enforces a 5 MB max size (header-check first, then actual buffer check).
 *   5. Re-uploads the bytes to our own object storage.
 *   6. Returns the owned path served via /api/storage/objects/…
 *
 * NEVER stores the raw external URL — callers always get back a path we own.
 * This satisfies the `validateOwnedAssetPath` rule in the settings registry.
 */
export async function importAssetFromUrl(url: string): Promise<string> {
  // Step 1 — validate URL shape
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("URL must use http or https protocol");
  }

  // Step 2 — fetch with timeout
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch URL: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(
      `URL returned ${res.status} ${res.statusText} — only publicly accessible URLs are supported`,
    );
  }

  // Step 3 — validate Content-Type
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim()?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(
      `URL does not point to an image (got Content-Type: "${contentType || "unknown"}"). ` +
        "Supported formats: JPEG, PNG, WebP, GIF, SVG.",
    );
  }

  // Step 4a — early-reject on Content-Length header if available
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
    throw new Error("Image exceeds the 5 MB size limit");
  }

  // Step 4b — actual buffer check
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    throw new Error(
      `Image exceeds the 5 MB size limit (actual: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`,
    );
  }

  // Step 5 — re-upload to object storage
  const ext =
    contentType === "image/svg+xml" ? "svg"
    : contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : contentType === "image/gif" ? "gif"
    : "jpg";

  const filename = `${randomUUID()}.${ext}`;
  const objectPath = await objectStorageService.uploadGeneratedAsset(buffer, filename, contentType);
  // objectPath is "/objects/generations/uuid.ext" — serve via the existing storage proxy
  return `/api/storage${objectPath}`;
}
