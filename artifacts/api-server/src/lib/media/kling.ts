import { createHmac } from "crypto";
import type { MediaAdapter, PollResult, SubmitResult, GenerationStatus, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.klingai.com";

// Kling's API requires a signed JWT for every request rather than a raw
// Bearer token. The user's BYOK key must be in the format
// "accessKey:secretKey" (colon-delimited), exactly as shown on the Kling
// developer console (klingai.com). The JWT is cheap to generate client-side
// and expires after 30 minutes — a fresh one is minted per request.
//
// If the key does NOT contain a colon, it is treated as a pre-generated
// Bearer token (some Kling plans issue a long-lived access token directly).
function makeAuthHeader(apiKey: string): string {
  const colonIdx = apiKey.indexOf(":");
  if (colonIdx === -1) {
    // Simple Bearer token — no JWT signing needed.
    return `Bearer ${apiKey}`;
  }

  const accessKey = apiKey.slice(0, colonIdx);
  const secretKey = apiKey.slice(colonIdx + 1);

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }),
  ).toString("base64url");
  const sig = createHmac("sha256", secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `Bearer ${header}.${payload}.${sig}`;
}

function requestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: makeAuthHeader(apiKey),
    "Content-Type": "application/json",
  };
}

function classifyError(code: number, message: string): ProviderErrorKind {
  // Kling uses numeric error codes: 1002 = quota/balance; 1000-range = bad request.
  if (code === 1002 || /quota|balance|credits|limit/i.test(message)) return "capacity";
  if (/invalid|parameter|required|missing/i.test(message)) return "validation";
  return "unknown";
}

function mapStatus(klingStatus: string): GenerationStatus {
  switch (klingStatus) {
    case "submitted":
      return "pending";
    case "processing":
      return "processing";
    case "succeed":
      return "completed";
    case "failed":
      return "failed";
    default:
      // Treat unknown statuses as still-processing rather than failing immediately.
      return "processing";
  }
}

// Provider-specific field quirks vs our paramsSchema naming conventions.
// Confirmed against Kling API docs (https://docs.klingai.com):
//   - `duration` is an integer in the request body (seconds), not a string.
//   - `mode` in our UI is "standard"/"professional"; Kling's API uses "std"/"pro".
function normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };

  if (typeof normalized.duration === "string" && /^\d+$/.test(normalized.duration)) {
    normalized.duration = Number(normalized.duration);
  }
  if (normalized.mode === "standard") normalized.mode = "std";
  if (normalized.mode === "professional") normalized.mode = "pro";

  return normalized;
}

export const klingAdapter: MediaAdapter = {
  // Cheapest read-only authenticated call — listing models.
  // 401/403 means the key (or the JWT derived from it) is rejected.
  async validateKey(apiKey): Promise<boolean> {
    let headers: Record<string, string>;
    try {
      headers = requestHeaders(apiKey);
    } catch {
      return false; // malformed key (e.g. empty secret after the colon)
    }
    const res = await fetch(`${BASE_URL}/v1/models`, { headers });
    if (res.status === 401 || res.status === 403) return false;
    // Any other status (200, 404, 405) means the key was accepted — the
    // endpoint may not exist on all plans, but auth passed.
    return true;
  },

  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    // providerModelPath = the Kling model name, e.g. "kling-v1-5".
    // `prompt` is injected into params by generations.ts (providerParams).
    const { prompt, ...rest } = params as { prompt: string; [k: string]: unknown };
    const normalized = normalizeParams(rest);

    const res = await fetch(`${BASE_URL}/v1/videos/text2video`, {
      method: "POST",
      headers: requestHeaders(apiKey),
      body: JSON.stringify({
        model_name: providerModelPath,
        prompt,
        ...normalized,
      }),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok || (body?.code !== undefined && body.code !== 0)) {
      const message = body?.message || `Kling submit failed with HTTP ${res.status}`;
      const code = body?.code ?? -1;
      throw new ProviderError(classifyError(code, message), message);
    }

    const taskId: string | undefined = body?.data?.task_id;
    if (!taskId) {
      throw new ProviderError("unknown", "Kling submit response missing data.task_id.");
    }

    return { kind: "async", providerTaskId: taskId };
  },

  async poll(providerTaskId, apiKey): Promise<PollResult> {
    const res = await fetch(`${BASE_URL}/v1/videos/text2video/${providerTaskId}`, {
      headers: requestHeaders(apiKey),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok || (body?.code !== undefined && body.code !== 0)) {
      const message = body?.message || `Kling poll failed with HTTP ${res.status}`;
      const code = body?.code ?? -1;
      throw new ProviderError(classifyError(code, message), message);
    }

    const data = body?.data;
    const status = mapStatus(data?.task_status ?? "");
    const videos: Array<{ url: string }> = data?.task_result?.videos ?? [];
    const outputUrls = videos.map((v) => v.url).filter(Boolean);

    return {
      status,
      outputUrls,
      errorMessage:
        status === "failed"
          ? (data?.task_result?.error ?? "Kling generation failed")
          : undefined,
    };
  },
};
