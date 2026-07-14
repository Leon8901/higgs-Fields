---
name: Studio UI polish session
description: Complete list of fixes applied in the UI polish / audit-resolution pass.
---

## Dead links resolved
- Footer Resources: Documentation→/tools, API Reference→/api-keys, Community→/apps, Blog→/presets
- Footer Company: About→/pricing, Pricing→/pricing, Contact→mailto:support@higgsfield.ai, Get Started→/sign-up
- Footer social: Twitter/X→x.com, Discord→discord.com (GitHub removed)
- Pricing page "Contact Sales" button → mailto:support@higgsfield.ai (via Button asChild + <a>)
- API Keys page "Learn more" → /tools (Explore models)

## category-studio.tsx changes
- Added `@keyframes audioWave { from height:--bar-min; to height:--bar-peak }` to index.css
- Added `AudioWaveformDecor` component: 64 deterministic animated bars, opacity ~0.08-0.16 of primary color, placed absolutely in the empty-state div for audio category
- Audio empty state tagline: "Ready to give your scene **a voice?**" (instead of card stack)
- Image/Video empty state: "Start creating with **{model.name}**" (removed awkward "using " prefix)
- Added `durationField` and `charsField` (matches key "characters" or "voice_id") to surfaced controls
- `surfacedKeys` expanded: now includes "duration", "characters", "voice_id"
- Duration select chip (appends "s" if value is a bare number) shown in controls row for video/audio
- Voice/character select chip with Mic icon shown in controls row for audio
- Audio result player: replaced Music icon + bare <audio> with animated waveform bars + styled audio element
- Loading text: category-aware ("videos", "tracks", "images")
- Removed the fake "Draw" placeholder button entirely
- Removed `Pencil` from lucide imports; added `Mic`
- `CanvasArea` now accepts `category: Category` prop

## API server
- Added `artifacts/api-server/src/middlewares/rateLimit.ts`: in-memory fixed-window (1 min / 20 req) per user
- `POST /generations` now uses `generationsRateLimit()` middleware; returns 429 + Retry-After header

## Home page
- App search input wired: `appSearch` state + `filteredApps` computed var; `disabled` removed

**Why:** All items from the system audit "dead links / UI gaps / production-readiness" list except:
- Camera motion controls (requires WaveSpeed API integration change)
- Voice cloning / music generation (requires new provider)
- Collections/admin panel (new feature scope)
- Razorpay billing (requires user to configure keys)
