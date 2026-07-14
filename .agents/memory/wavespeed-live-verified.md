---
name: WaveSpeed live generation — verified findings
description: Results of real end-to-end generation test via clerkClient session + POST /api/generations; includes known response-shape gotcha.
---

## Key facts confirmed in live test (July 2026)

- `POST /api/generations` returns the generation object **flat** at the root of the response body — NOT nested under a `generation` key. Scripts and tests that do `data.generation.status` will silently read `undefined`.
- Background poller fires every 15 s and completes a typical image generation in ~29 s end-to-end.
- `creditsCharged` is correctly deducted at submit time and the ledger row is created in the same transaction.
- When `PRIVATE_OBJECT_DIR` / `DEFAULT_OBJECT_STORAGE_BUCKET_ID` are not configured, `persistGeneratedAssets` gracefully returns the provider's CloudFront URL directly — the generation is still usable, just not durably re-hosted.
- WAVESPEED_API_KEY must be set as a Replit Secret for platform-key generations to work; it was missing and the route returned 500 ("No API key available") until the secret was added.

**Why:** these are non-obvious runtime behaviors that code-reading cannot confirm — they were found only by live testing.

**How to apply:** when writing test scripts against this API, use `data?.id ?? data?.generation?.id` for the generation ID, and `data?.id ? data : data?.generation` for the full object.
