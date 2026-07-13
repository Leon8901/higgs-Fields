import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";

// Re-hosts a provider-returned generation asset on our own storage. WaveSpeed
// (and providers generally) only guarantee their hosted output URLs for a
// limited retention window — see https://wavespeed.ai docs — so saving that
// raw URL directly into the `generations` table is a ticking data-loss bug.
// This downloads the bytes once, right after generation, and re-uploads them
// to our own object storage bucket so the link never expires.

const objectStorageService = new ObjectStorageService();

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
// storage. Throws on any failure (network, non-2xx, storage write) — callers
// must treat that as "the generation did not complete", not silently fall
// back to the temporary provider URL.
export async function persistGeneratedAsset(sourceUrl: string): Promise<string> {
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
