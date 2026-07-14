---
name: BYOK key validation false-rejects scoped/restricted keys
description: Why validateKey() checks can wrongly reject a genuinely working BYOK key, and the fix pattern.
---

Several providers (confirmed: OpenAI, ElevenLabs) let users create **restricted/scoped** API keys
that are only permitted for specific endpoint categories (e.g. "Images only", "Text to Speech
only"). If an adapter's `validateKey()` probes a *different* endpoint than the one it actually
uses for generation (e.g. ElevenLabs `GET /v1/user` when generation uses
`POST /v1/text-to-speech/*`; OpenAI `GET /v1/models` when generation uses
`/v1/images/generations`), a correctly-scoped, fully-working key gets a false 401 and is rejected
at save time — even though it would work fine for real generations.

**Why:** confirmed via provider docs/community reports: OpenAI restricted keys can lack the
`model.request` scope; ElevenLabs keys support "Scope restriction" per their docs. Both providers
distinguish this from a truly wrong key via the error body: OpenAI's real-bad-key message is
"Incorrect API key provided"; ElevenLabs' is `detail.status === "invalid_api_key"`. Any other
401/403 reason is ambiguous (could be scope, not a bad key).

**How to apply:** in any `validateKey()` implementation, only return `false` (hard reject) when the
error body matches the provider's documented "definitely wrong key" signal. Treat any other
401/403 as "can't fully verify from this endpoint" and let the key save through — don't block the
user on a check that probes a different permission scope than the app actually uses. When adding a
new BYOK adapter, check the provider's docs for restricted/scoped-key support before picking a
validation endpoint, and prefer probing the exact capability the adapter uses if a lightweight
read-only version exists.
