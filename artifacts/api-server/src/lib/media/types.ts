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
  // Checks whether `apiKey` is actually valid for this provider, via a cheap
  // read-only call (never a paid generation). Optional: a provider can be
  // registered in the `providers` DB table (so it shows up in the BYOK UI)
  // before its adapter implements this — routes/api-keys.ts treats a missing
  // `validateKey` as "can't verify yet" and saves the key with status
  // "unknown" instead of blocking the save.
  validateKey?(apiKey: string): Promise<boolean>;
}

// Classifies a failure raised by an adapter so route handlers can log the
// real cause (visible only to us, in server logs) while showing end users a
// generic, non-leaky message. Never surface `providerMessage` to end users —
// it can contain provider account/billing details.
export type ProviderErrorKind =
  | "capacity" // provider account is out of funds/quota/concurrency — not the end user's fault, needs admin action (top up, swap key)
  | "validation" // our request body didn't match what the provider expects — a bug in our model catalog/adapter, not the end user's fault
  | "unknown"; // anything else (network error, unexpected shape, etc.)

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly providerMessage: string;

  constructor(kind: ProviderErrorKind, providerMessage: string) {
    super(providerMessage);
    this.name = "ProviderError";
    this.kind = kind;
    this.providerMessage = providerMessage;
  }
}
