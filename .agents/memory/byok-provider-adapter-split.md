---
name: BYOK provider registry vs. code adapter split
description: How multi-provider "bring your own key" is architected — data-driven DB registry for metadata, optional code adapter for validation/generation.
---

The BYOK system splits provider *metadata* from provider *capability*:
- A `providers` DB table (slug, name, icon, capabilities, supportsByok, keyFormatHint, status) is the source of truth the frontend renders from. Adding a provider row is enough to make it appear in the generic key-management UI — no frontend code change needed.
- A code adapter (keyed by the same slug) is looked up separately and only needed for actually calling the provider (submit/poll) or validating a key (`validateKey`, optional on the adapter interface).
- A provider can exist in the DB with no adapter yet (frontend shows it, key validation gracefully reports `status: "unknown"` instead of blocking the save) — this decouples "announce a provider" from "code supports it."

**Why:** lets the catalog grow without shipping frontend changes per provider, while keeping validation optional/non-blocking when an adapter isn't implemented yet.

**How to apply:** when adding a new BYOK provider, add a `providers` row first (visible immediately); implement the adapter's `validateKey`/generation methods when ready. Saved keys require `status === "valid"` before routing logic will actually use them for a real generation — an unverified or invalid key is never silently used.
