import type { MediaAdapter, PollResult, SubmitResult, GenerationStatus, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.wavespeed.ai/api/v3";

// WaveSpeed returns the same HTTP status/`code` (400) for both "your account
// is out of money" and "your request body is malformed", so the only way to
// tell them apart is the message text. Pattern-match it once here so callers
// get a stable `kind` instead of re-parsing prose every time.
function classifyError(message: string): ProviderErrorKind {
  const lower = message.toLowerCase();
  if (/insufficient credit|top up|concurrency limit|quota/.test(lower)) return "capacity";
  if (/invalid request body|must be one of|must be an integer|is required/.test(lower)) return "validation";
  return "unknown";
}

// WaveSpeed-specific quirks that don't match how these values are authored
// in our model catalog (lib/db/seed.ts). Confirmed against the live API's
// own validation error messages:
//   - `resolution` is case-sensitive and lowercase-only (e.g. "2k", not "2K").
//   - `duration` must be a JSON integer, not a numeric string, across every
//     video model (Seedance, Kling, Veo, Sora, WAN).
// Normalizing here — rather than in the shared catalog/UI layer — keeps this
// provider-specific behavior contained to the adapter that owns it.
function normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };

  if (typeof normalized.resolution === "string") {
    normalized.resolution = normalized.resolution.toLowerCase();
  }

  if (typeof normalized.duration === "string" && /^\d+(\.\d+)?$/.test(normalized.duration)) {
    normalized.duration = Number(normalized.duration);
  }

  return normalized;
}

function mapStatus(waveStatus: string): GenerationStatus {
  switch (waveStatus) {
    case "created":
    case "queued":
      return "pending";
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
}

export const wavespeedAdapter: MediaAdapter = {
  // Cheap, read-only account check — costs nothing and never triggers a
  // generation. WaveSpeed returns 200 with a balance for any valid key and
  // 401/403 for a bad one. See https://wavespeed.ai/docs/check-balance.
  async validateKey(apiKey): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok;
  },

  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    const res = await fetch(`${BASE_URL}/${providerModelPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizeParams(params)),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || body?.error || `WaveSpeed submit failed with status ${res.status}`;
      throw new ProviderError(classifyError(message), message);
    }

    const taskId = body?.data?.id;
    if (!taskId) {
      throw new ProviderError("unknown", "WaveSpeed submit response missing task id.");
    }

    return { providerTaskId: taskId };
  },

  async poll(providerTaskId, apiKey): Promise<PollResult> {
    const res = await fetch(`${BASE_URL}/predictions/${providerTaskId}/result`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || body?.error || `WaveSpeed poll failed with status ${res.status}`;
      throw new ProviderError(classifyError(message), message);
    }

    const data = body?.data;
    const status = mapStatus(data?.status);
    const outputs: string[] = Array.isArray(data?.outputs) ? data.outputs : [];

    return {
      status,
      outputUrls: outputs,
      errorMessage: status === "failed" ? (data?.error || "Generation failed") : undefined,
    };
  },
};
