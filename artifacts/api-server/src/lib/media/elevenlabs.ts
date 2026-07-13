import { randomUUID } from "crypto";
import type { MediaAdapter, PollResult, SubmitResult, ProviderErrorKind } from "./types";
import { ProviderError } from "./types";
import { ObjectStorageService } from "../objectStorage";

const BASE_URL = "https://api.elevenlabs.io";

// Prefix embedded in providerTaskId to signal that the audio has already been
// uploaded to our object storage. poll() decodes the path and returns
// "completed" immediately — no real async job exists on ElevenLabs' side.
const STORED_PREFIX = "elevenlabs-stored:";

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

  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    // ElevenLabs TTS is synchronous: the response body IS the audio binary
    // (mp3). We upload it directly to object storage here and embed the
    // stored path in providerTaskId so poll() can return "completed" with the
    // permanent /api/storage URL without any real async polling.
    //
    // assetPersistence.ts skips re-persisting URLs that already start with
    // "/api/storage/" — so statusSync won't wastefully re-download and
    // re-upload the file we just stored.
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

    return { providerTaskId: STORED_PREFIX + objectPath };
  },

  async poll(providerTaskId, _apiKey): Promise<PollResult> {
    if (!providerTaskId.startsWith(STORED_PREFIX)) {
      throw new ProviderError(
        "unknown",
        `elevenlabsAdapter.poll: unexpected providerTaskId format "${providerTaskId}" — expected "${STORED_PREFIX}..." prefix.`,
      );
    }
    const objectPath = providerTaskId.slice(STORED_PREFIX.length);
    // Root-relative path served by GET /api/storage — matches the format
    // persistGeneratedAssets() returns for all other providers.
    return {
      status: "completed",
      outputUrls: [`/api/storage${objectPath}`],
    };
  },
};
