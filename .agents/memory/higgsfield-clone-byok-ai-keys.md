---
name: Higgsfield clone uses direct BYOK keys, not Replit AI Integrations proxy
description: Why OPENROUTER_API_KEY and WAVESPEED_API_KEY are requested as real user secrets instead of wiring the Replit AI Integrations OpenRouter blueprint.
---

This project's LLM planning layer (`lib/llm/client.ts`) and media generation (WaveSpeed adapter) intentionally read `OPENROUTER_API_KEY` / `WAVESPEED_API_KEY` directly from `process.env`, bypassing the Replit AI Integrations proxy (`AI_INTEGRATIONS_OPENROUTER_*`).

**Why:** The user explicitly chose a BYOK (bring-your-own-key) design for this product — end users can also add their own WaveSpeed key per-account (see `userApiKeysTable`/`api-keys` routes) to skip platform credits. The platform-level `OPENROUTER_API_KEY`/`WAVESPEED_API_KEY` follow the same "real key, not managed proxy" pattern for consistency, and a code comment in `client.ts` states this was deliberate, not an oversight.

**How to apply:** Don't run `setupReplitAIIntegrations({ providerSlug: "openrouter" })` or push toward the AI Integrations blueprint for this project — request `OPENROUTER_API_KEY` and `WAVESPEED_API_KEY` via `requestSecrets` instead. Also: Razorpay billing here is designed to run with placeholder/absent `RAZORPAY_KEY_ID`/`_SECRET`/`_WEBHOOK_SECRET` — checkout routes and the webhook handler must degrade gracefully (503/200 with a clear message), never crash, until real KYC-backed keys are added.
