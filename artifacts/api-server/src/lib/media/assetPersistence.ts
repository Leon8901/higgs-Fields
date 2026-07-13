import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";

// Re-hosts a provider-returned generation asset on our own storage. WaveSpeed
// (and providers generally) only guarantee their hosted output URLs for a
// limited retention window — see https://wavespeed.ai docs — so saving that
// raw URL directly into the `generations` table is a ticking data-loss bug.
// This downloads the bytes once, right after generation, and re-uploads them
// to our own object storage bucket so the link never expires.
//
// ⚠️  Graceful degradation: if PRIVATE_OBJECT_DIR is not set (e.g. after a
// fresh re-import before setupObjectStorage() has been called), we skip the
// re-host and return the provider URL directly. The generation is still
// visible to the user; only long-term durability is affected. A startup
// warning in index.ts surfaces this clearly in server logs.

const objectStorageService = new ObjectStorageService();

/** True when object storage env vars are present and the re-host can proceed. */
function isStorageConfigured(): boolean {
  return Boolean(process.env.PRIVATE_OBJECT_DIR && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
};

function guessExtension(contentType: string, sourceUrl: string): string {
  if (EXT_BY_CONTENT_TYPE[contentType]) return EXT_BY_CONTENT_TYPE[contentType];
  const fromUrl = sourceUrl.split("?")[0].split(".").pop();
  if (fromUrl && fromUrl.length <= 5 && /^[a-zA-Z0-9]+$/.test(fromUrl)) return fromUrl.toLowerCase();
  return "bin";
}

// Downloads a single provider-hosted asset and re-uploads it to our object
// storage. If storage is not configured, returns the provider URL directly
// rather than throwing — the generation succeeds with a temporary URL instead
// of failing and refunding credits.
export async function persistGeneratedAsset(sourceUrl: string): Promise<string> {
  if (!isStorageConfigured()) {
    // Storage not set up yet (e.g. fresh re-import). Return the provider URL
    // so the generation is still usable; the URL has a limited retention window
    // but is vastly better than failing. Run setupObjectStorage() to fix durably.
    return sourceUrl;
  }

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to download generated asset from provider (status ${res.status})`);
  }
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `${randomUUID()}.${guessExtension(contentType, sourceUrl)}`;
  const objectPath = await objectStorageService.uploadGeneratedAsset(buffer, filename, contentType);
  // Root-relative: this app serves the API at a fixed `/api` mount on the
  // same domain as the web frontend in both dev and prod (single-domain,
  // path-routed artifacts), so this resolves correctly from any page.
  return `/api/storage${objectPath}`;
}

export async function persistGeneratedAssets(sourceUrls: string[]): Promise<string[]> {
  const persisted: string[] = [];
  for (const url of sourceUrls) {
    persisted.push(await persistGeneratedAsset(url));
  }
  return persisted;
}
