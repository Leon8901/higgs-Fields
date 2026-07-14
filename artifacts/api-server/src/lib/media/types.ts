// Provider-abstraction layer. Every media provider (WaveSpeedAI today,
// others later) implements this interface. Call sites depend only on
// `getAdapter` in ./registry — never on a concrete adapter — so a model can
// be repointed to a different provider by changing its `adapter` +
// `providerModelPath` columns in the `models` table, with no code changes.

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

// What submit() returns. Two strictly distinct shapes — never combined:
//
//   { kind: "async", providerTaskId }
//     The provider started a background job. poll() must be called periodically
//     until it reports "completed" or "failed". providerTaskId is an opaque job
//     identifier stored on the generation row and passed back to poll() verbatim.
//     It NEVER carries encoded result data (URLs, binary, etc.).
//
//   { kind: "completed", outputUrls }
//     The provider returned the final result inline (synchronous API — e.g.
//     DALL·E, ElevenLabs TTS). The generation service finalizes the generation
//     immediately; no polling is required. providerTaskId is never written to
//     the database for these generations.
//
export type SubmitResult =
  | { kind: "async"; providerTaskId: string }
  | { kind: "completed"; outputUrls: string[] };

export interface PollResult {
  status: GenerationStatus;
  outputUrls: string[];
  errorMessage?: string;
}

export interface MediaAdapter {
  // Submits a generation task to the provider. Returns either a background job
  // ID (async adapters) or the completed output directly (sync adapters).
  submit(providerModelPath: string, params: Record<string, unknown>, apiKey: string): Promise<SubmitResult>;

  // Polls a previously submitted async task for completion. Required only on
  // async adapters (those whose submit() returns { kind: "async" }).
  // Sync adapters omit this — the generation service never calls poll() on a
  // generation whose providerTaskId is null, so the absence is safe.
  poll?(providerTaskId: string, apiKey: string): Promise<PollResult>;

  // Checks whether `apiKey` is valid for this provider via a cheap read-only
  // call (never a paid generation). Optional: a provider can be registered in
  // the `providers` DB table before its adapter implements this — the API-keys
  // route treats a missing validateKey as "can't verify yet" and saves the key
  // with status "unknown" rather than blocking the save.
  validateKey?(apiKey: string): Promise<boolean>;
}

// Classifies a failure raised by an adapter so route handlers can log the real
// cause (visible only in server logs) while showing users a generic message.
// Never surface `providerMessage` to end users — it can contain provider
// account/billing details.
export type ProviderErrorKind =
  | "capacity"   // out of funds/quota/concurrency — needs admin action (top up, rotate key)
  | "validation" // request didn't match what the provider expects — bug in model catalog/adapter
  | "unknown";   // network error, unexpected shape, etc.

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
