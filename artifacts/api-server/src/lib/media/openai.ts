import type { MediaAdapter, PollResult, SubmitResult, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.openai.com/v1";

// Sentinel prefix embedded in providerTaskId for synchronous providers.
// submit() calls the API and gets the result immediately; poll() decodes the
// URL and returns "completed" on the first check — the background poller
// doesn't need to know or care that no real async job exists.
const SYNC_PREFIX = "openai-sync:";

function classifyError(status: number, message: string): ProviderErrorKind {
  if (status === 429) return "capacity"; // rate-limit / quota exhausted
  if (status === 400 || status === 422) return "validation"; // bad request shape
  return "unknown";
}

// Maps our paramsSchema field names to the exact fields OpenAI's images API
// expects. Our catalog uses "size", "quality", "style" directly — these align
// with OpenAI's naming — so normalization is straightforward defaults-filling.
function normalizeParams(params: Record<string, unknown>): {
  size: string;
  quality: string;
  style: string;
} {
  return {
    size: String(params.size ?? "1024x1024"),
    quality: String(params.quality ?? "standard"),
    style: String(params.style ?? "vivid"),
  };
}

export const openaiAdapter: MediaAdapter = {
  // Cheap authenticated read-only call — lists available models.
  // 401/403 = invalid key; any other response means the key is accepted.
  async validateKey(apiKey): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok;
  },

  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    // OpenAI image generation is synchronous: one POST returns the result.
    // We embed the returned image URL in providerTaskId so poll() can resolve
    // immediately without any real async polling.
    // providerModelPath = the OpenAI model name, e.g. "dall-e-3".
    const { size, quality, style } = normalizeParams(params);

    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: providerModelPath,
        prompt: params.prompt, // injected by generations.ts into providerParams
        n: 1,
        size,
        quality,
        style,
        response_format: "url", // temporary URL — statusSync will re-host it
      }),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body?.error?.message || `OpenAI images/generations failed with status ${res.status}`;
      throw new ProviderError(classifyError(res.status, message), message);
    }

    const url: string | undefined = body?.data?.[0]?.url;
    if (!url) {
      throw new ProviderError("unknown", "OpenAI response missing image URL in data[0].url.");
    }

    // Embed the image URL as the task ID — poll() decodes it and returns
    // "completed" immediately. statusSync then calls persistGeneratedAssets()
    // to download from OpenAI and re-host on our own storage before the
    // temporary OpenAI URL expires (1-hour window).
    return { providerTaskId: SYNC_PREFIX + url };
  },

  async poll(providerTaskId, _apiKey): Promise<PollResult> {
    if (!providerTaskId.startsWith(SYNC_PREFIX)) {
      throw new ProviderError(
        "unknown",
        `openaiAdapter.poll: unexpected providerTaskId format "${providerTaskId}" — expected "${SYNC_PREFIX}..." prefix.`,
      );
    }
    const url = providerTaskId.slice(SYNC_PREFIX.length);
    return { status: "completed", outputUrls: [url] };
  },
};
