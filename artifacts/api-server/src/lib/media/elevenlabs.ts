import { randomUUID } from "crypto";
import type { MediaAdapter, SubmitResult, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";
import { ObjectStorageService } from "../objectStorage";

const BASE_URL = "https://api.elevenlabs.io";

// Module-level instance (same pattern as assetPersistence.ts).
const objectStorage = new ObjectStorageService();

function classifyError(status: number, message: string): ProviderErrorKind {
  if (status === 429) return "capacity"; // quota / rate limit
  if (status === 400 || status === 422) return "validation"; // bad request body
  return "unknown";
}

// Maps human-readable voice names (used as paramsSchema option values so the
// UI shows recognisable labels) to ElevenLabs voice IDs (what the API needs).
// This mapping lives here — in adapter code — deliberately: it is not the kind
// of "hardcoding" this project avoids (provider names in DB vs code). Which
// voices exist for a given provider is provider-implementation knowledge that
// belongs in the adapter, not in the DB.
//
// ── Known limitation: only pre-mapped voices are supported ───────────────────
// Custom voices from a user's own ElevenLabs account (created via ElevenLabs
// Voice Lab or cloned from audio samples) are NOT supported by this adapter
// today. The paramsSchema voice_id select only exposes the voices listed here.
//
// To use a custom voice, the user would need to know their voice's raw ID from
// the ElevenLabs console and pass it directly — but the UI's select field
// constrains choices to this list, so there is no UI path to custom voices.
//
// This is an intentional temporary limitation, not a silent gap:
//   • Adding custom-voice support would require either:
//     a) a new "voice_id (raw)" text-input field in the paramsSchema, OR
//     b) a server-side call to GET /v1/voices with the user's key to enumerate
//        their library and populate a dynamic select.
//   • Neither is implemented. If users report wanting custom voices, option (b)
//     is the right UX — it does not require any DB schema changes, only a new
//     API endpoint that calls ElevenLabs and returns voice options.
//
// The raw voice ID is still accepted if it doesn't match any map key (see
// resolveVoiceId below), so power users who manually POST to /api/generations
// with a known ID can use custom voices today — only the UI enforces the limit.
const VOICE_ID_MAP: Record<string, string> = {
  Rachel:  "21m00Tcm4TlvDq8ikWAM",
  Domi:    "AZnzlk1XvdvUeBnXmlld",
  Bella:   "EXAVITQu4vr4xnSDxMaL",
  Antoni:  "ErXwobaYiN019PkySvjV",
  Elli:    "MF3mGyEYCl7XYWbV9V6O",
  Josh:    "TxGEqnHWrfWFTfGW9XjX",
  Adam:    "pNInz6obpgDQGcFmaJgB",
  Sam:     "yoZ06aMxZJJ28mfd3POQ",
};

function resolveVoiceId(raw: string): string {
  // Accept both a human-readable name (from paramsSchema select options) and a
  // raw ID (in case the caller passes one directly or we add more voices later).
  return VOICE_ID_MAP[raw] ?? raw;
}

function normalizeParams(
  providerModelPath: string,
  params: Record<string, unknown>,
): { voiceId: string; modelId: string; stability: number; similarityBoost: number } {
  // providerModelPath encodes both model and default voice:
  //   "<model_id>/<voice_name_or_id>"  e.g. "eleven_multilingual_v2/Rachel"
  // This lets each DB model row pick a default voice without any frontend
  // changes, while paramsSchema's voice_id select overrides it per-generation.
  const [modelFromPath, voiceFromPath] = providerModelPath.split("/");

  const rawVoice = String(params.voice_id ?? voiceFromPath ?? "Rachel");
  const rawModel = String(modelFromPath ?? "eleven_multilingual_v2");

  return {
    voiceId: resolveVoiceId(rawVoice),
    modelId: rawModel,
    stability: Number(params.stability ?? 0.5),
    similarityBoost: Number(params.similarity_boost ?? 0.75),
  };
}

export const elevenlabsAdapter: MediaAdapter = {
  // GET /v1/user — cheapest authenticated read; 401/403 = invalid key.
  async validateKey(apiKey): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/v1/user`, {
      headers: { "xi-api-key": apiKey },
    });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok;
  },

  // ElevenLabs TTS is synchronous: the response body IS the audio binary (mp3).
  // We upload it to our own object storage here and return { kind: "completed" }
  // with the permanent /api/storage URL. The generation service finalises the
  // generation immediately — no polling loop is needed.
  //
  // We upload binary in submit() (rather than letting the standard
  // persistGeneratedAssets() download-then-reupload path handle it) because
  // ElevenLabs returns raw bytes with no publicly reachable download URL to
  // pass through that path.
  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    const { voiceId, modelId, stability, similarityBoost } = normalizeParams(
      providerModelPath,
      params,
    );

    const res = await fetch(`${BASE_URL}/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: String(params.prompt ?? ""),
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      }),
    });

    if (!res.ok) {
      let message: string;
      try {
        const err: any = await res.json();
        message =
          err?.detail?.message || String(err?.detail) || `ElevenLabs TTS failed with status ${res.status}`;
      } catch {
        message = `ElevenLabs TTS failed with status ${res.status}`;
      }
      throw new ProviderError(classifyError(res.status, message), message);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const filename = `${randomUUID()}.mp3`;

    let objectPath: string;
    try {
      objectPath = await objectStorage.uploadGeneratedAsset(audioBuffer, filename, "audio/mpeg");
    } catch (err) {
      // Object storage not configured or upload failed — surface as a clear
      // operational error rather than a silent failure.
      throw new ProviderError(
        "unknown",
        `ElevenLabs audio generated but could not be stored: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // The /api/storage prefix matches what persistGeneratedAssets() returns for
    // all other providers, so the output_url format is consistent across the
    // entire system. persistGeneratedAssets() is idempotent: it skips re-
    // downloading paths that already start with "/api/storage/", so passing
    // this URL through the standard asset-persistence step is always safe.
    return { kind: "completed", outputUrls: [`/api/storage${objectPath}`] };
  },

  // poll() is intentionally absent — this is a synchronous adapter.
  // The generation service never calls poll() on a generation with no
  // providerTaskId, so omitting it here is safe. See types.ts for the contract.
};
