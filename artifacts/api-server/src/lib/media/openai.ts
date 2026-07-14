import type { MediaAdapter, SubmitResult, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.openai.com/v1";

function classifyError(status: number, message: string): ProviderErrorKind {
  if (status === 429) return "capacity"; // rate-limit / quota exhausted
  if (status === 400 || status === 422) return "validation"; // bad request shape
  return "unknown";
}

// Maps our paramsSchema field names to the exact fields OpenAI's images API
// expects. Our catalog uses "size", "quality", "style" directly — these align
// with OpenAI's naming — so normalisation is straightforward defaults-filling.
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

  // OpenAI image generation is synchronous: one POST returns the final image
  // URL inline. submit() calls the API and returns { kind: "completed" } so
  // the generation service can finalise the generation immediately without any
  // polling loop. No providerTaskId is stored for these generations.
  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
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
        // "url" returns a temporary CDN link. The generation service passes it
        // through persistGeneratedAssets() which re-hosts it on our own storage
        // before writing output_urls — so the temporary expiry is not a concern.
        response_format: "url",
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

    return { kind: "completed", outputUrls: [url] };
  },

  // poll() is intentionally absent — this is a synchronous adapter.
  // The generation service never calls poll() on a generation with no
  // providerTaskId, so omitting it here is safe. See types.ts for the contract.
};
