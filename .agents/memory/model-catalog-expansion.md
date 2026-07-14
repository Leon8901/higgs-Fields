---
name: Model catalog expansion (Higgsfield clone)
description: How to add new AI generation models to this project's catalog, and the one real architecture limit that blocks certain model types.
---

Adding a new generation model to the Higgsfield clone is **DB-only** work in the common case:
`model-studio.tsx` (the shared generation form used by /image, /video, /audio) renders entirely
off `model.paramsSchema.fields` and `model.adapter` — no frontend or adapter code needs to change
to surface a new model. Add a row to the `models` array in `lib/db/seed.ts` (and it auto-mirrors
into the `tools` marketing table), re-run `pnpm --filter @workspace/db run seed`.

**Why:** confirmed by reading `model-studio.tsx` in full — it has no per-model hardcoded branches.
The `wavespeed` adapter is a fully generic passthrough (params go straight into the WaveSpeed
request body for `providerModelPath`), and the `elevenlabs` adapter derives both the ElevenLabs
`model_id` and default voice from `providerModelPath` (`"<model_id>/<voice_name>"`), so even a new
ElevenLabs model (e.g. `eleven_v3`) needs no adapter changes — just a new seed row.

**Real limit — no video-upload field type:** `ParamField.type` only supports
`text | textarea | select | number | toggle | image`. Any model whose input is a *video* clip
(motion-control, video-to-video editing, video restyle) cannot be wired up today — the `image`
field type's uploader is image-only. Adding such a model requires a genuine frontend change (new
field type + uploader) and is out of scope for "DB-only" catalog additions. When asked to add a
full external model list (e.g. matching a competitor's menu) and asked to skip frontend changes,
skip video-input models explicitly and say why, rather than mis-mapping them onto the `image` field.

**How to apply:** before seeding a new model, check whether its real input contract needs a video
upload. If yes, defer it and flag it as needing a new field type. Everything else (text-to-image,
text-to-video, image-to-video via a single reference image, TTS) fits the existing schema.
