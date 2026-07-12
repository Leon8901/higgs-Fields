// Provider-abstraction layer. Every media provider (WaveSpeedAI today,
// others later) implements this interface. Call sites depend only on
// `generateMedia` in ./registry — never on a concrete adapter — so a model
// can be repointed to a different provider by changing its `adapter` +
// `providerModelPath` columns in the `models` table, with no code changes.

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface SubmitResult {
  providerTaskId: string;
}

export interface PollResult {
  status: GenerationStatus;
  outputUrls: string[];
  errorMessage?: string;
}

export interface MediaAdapter {
  // Submits a generation task to the provider. `providerModelPath` is the
  // provider-specific model identifier (e.g. WaveSpeed's `model_id`).
  submit(providerModelPath: string, params: Record<string, unknown>, apiKey: string): Promise<SubmitResult>;
  // Polls a previously submitted task for completion.
  poll(providerTaskId: string, apiKey: string): Promise<PollResult>;
}
