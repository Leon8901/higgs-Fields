import type { MediaAdapter } from "./types";
import { wavespeedAdapter } from "./wavespeed";

// Adapter registry keyed by the `models.adapter` column. Add new providers
// here as they come online; nothing else in the app needs to change.
const adapters: Record<string, MediaAdapter> = {
  wavespeed: wavespeedAdapter,
};

export function getAdapter(adapterKey: string): MediaAdapter {
  const adapter = adapters[adapterKey];
  if (!adapter) {
    throw new Error(`No media adapter registered for "${adapterKey}"`);
  }
  return adapter;
}

// Non-throwing lookup for call sites that must degrade gracefully when a
// provider is registered in the DB (so it's visible in the BYOK UI) before
// its adapter code exists — e.g. key validation in routes/api-keys.ts.
export function tryGetAdapter(adapterKey: string): MediaAdapter | undefined {
  return adapters[adapterKey];
}
