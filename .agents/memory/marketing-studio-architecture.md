---
name: Marketing Studio Architecture
description: Key decisions for the Marketing Studio feature — creative modes, prompt building, avatar/product state, and UI patterns.
---

## Creative mode system (Phase 1, complete)

Four modes replace the old UGC/Hook/Setting toggles: `ugc | cgi | cinematic | wildcard`.

Each mode:
- Controls the **model** used (`wan-2-2-image-to-video` / `kling-v3-pro` / `seedance-2-0`)
- Has a **distinct server-side system prompt** in `artifacts/api-server/src/config/creative-mode-prompts.ts`
- Sends to `POST /api/marketing/build-prompt` which calls OpenRouter (`FAST_MODEL`) with the mode's system prompt, or returns a deterministic fallback if the key is absent

UGC mode has sub-variants: `testimonial | unboxing | tutorial | handson` — sent as `ugcSubVariant` in the build-prompt request.

**Why:** The old toggle approach concatenated directives to one template. The real product uses mode-specific LLM system prompts that restructure camera language, pacing, and structure entirely.

**How to apply:** When adding new modes or changing prompt structure, edit `creative-mode-prompts.ts` server-side only — no frontend deploy needed.

## Prompt building flow

`handleSubmit` in `marketing-studio.tsx` is async:
1. Calls `POST /api/marketing/build-prompt` with mode, sub-variant, product info, avatar/image flags
2. If the call fails (network or missing key), falls back to a local `${productName}. ${description}` string
3. Only after the prompt is built does it call `createGeneration.mutate()`

The `promptBuilding` state disables the GENERATE button and shows a spinner during LLM planning.

## Favorites

Favorites are persisted to `localStorage` under key `mktStudio_favorites` as a JSON array of generation IDs. The `Set<number>` is loaded on mount and saved on every toggle.

**Why:** Favorites are a UI concern only; they don't need a round-trip to the DB. This makes them instant and available offline.

## Model selection by mode

| Mode       | modelId                  |
|------------|--------------------------|
| ugc        | wan-2-2-image-to-video   |
| cgi        | kling-v3-pro             |
| cinematic  | seedance-2-0             |
| wildcard   | seedance-2-0             |

These must match the DB seed values in `artifacts/api-server/src/db/seed.ts`.

## needsImage rule

`needsImage = creativeMode === "ugc"` — only UGC mode requires a product photo. The old template-level `needsImage` flag is still present on `TEMPLATES` but is NOT used to gate the GENERATE button.

## Template grid vs mode

The template picker (8 presets) and the mode switcher (4 modes) are independent:
- Template = visual style preset (affects the style directive label/color pill and previously the model)
- Mode = generation approach (controls the model and the LLM system prompt)
- The shuffle button picks a random template; the mode switcher picks the generation approach

## URL-to-Ad endpoint

`POST /api/marketing/url-analyze` — fetches a URL, strips HTML, calls OpenRouter with `FAST_MODEL` to extract `productName`, `tagline`, `description` as JSON. Returns 503 if `OPENROUTER_API_KEY` is absent.

## Ad Reference

Ad Reference section uploads a reference image and switches the template to `ugc-testimonial` (wan-2-2-image-to-video) + sets `imageUrl`. The description from the reference prompt is pre-filled.
