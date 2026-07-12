import type { MediaAdapter, PollResult, SubmitResult, GenerationStatus } from "./types";

const BASE_URL = "https://api.wavespeed.ai/api/v3";

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
  async submit(providerModelPath, params, apiKey): Promise<SubmitResult> {
    const res = await fetch(`${BASE_URL}/${providerModelPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || body?.error || `WaveSpeed submit failed with status ${res.status}`;
      throw new Error(message);
    }

    const taskId = body?.data?.id;
    if (!taskId) {
      throw new Error("WaveSpeed submit response missing task id.");
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
      throw new Error(message);
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
