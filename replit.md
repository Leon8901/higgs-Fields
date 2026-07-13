# Higgsfield AI

A full-stack AI creative platform website inspired by higgsfield.ai — featuring a dark cinematic aesthetic, AI tools catalog, community app gallery, pricing plans, and waitlist signup.

## Run & Operate

- `pnpm --filter @workspace/higgsfield run dev` — run the frontend (assigned port via workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, shadcn/ui components, Wouter router
- API: Express 5 + Zod validation
- DB: PostgreSQL + Drizzle ORM
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (tools, apps, pricing_plans, waitlist)
- `artifacts/api-server/src/routes/` — Express route handlers (tools, apps, pricing, stats, waitlist)
- `artifacts/higgsfield/src/pages/` — React pages (home, tools, category-studio, tool-detail redirect, apps, pricing)
- `artifacts/higgsfield/src/components/model-studio.tsx` — shared generation form/result panel used by the Image/Video/Audio category pages
- `artifacts/higgsfield/src/index.css` — design tokens and theme (dark mode, lime-green accent)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)

## Pages

- `/` — Homepage with hero, featured tools, app gallery, platform stats, waitlist CTA
- `/tools` (nav label "Explore") — Full tools catalog with category filter tabs (All/Image/Video/Audio), for browsing
- `/image`, `/video`, `/audio` — Per-category generation studios (mirrors higgsfield.ai): a model-switcher dropdown plus the shared generation form/result panel, instead of a separate page per model
- `/tools/:slug` — Legacy per-tool URL; resolves the model then redirects to `/{category}?model={slug}` so old links (home tool cards, Presets "Try it", Library "Regenerate") keep working
- `/apps` — Community app gallery with search + filter
- `/pricing` — Pricing plans with monthly/yearly toggle

## API Endpoints

- `GET /api/tools` — list tools (query: category, tag)
- `GET /api/tools/featured` — featured tools for homepage
- `GET /api/tools/:id` — single tool by ID
- `GET /api/apps` — list apps (query: filter, search)
- `GET /api/apps/stats` — gallery statistics
- `GET /api/pricing` — pricing plans
- `GET /api/stats` — platform-level stats
- `POST /api/waitlist` — join waitlist

## Architecture decisions

- OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas for end-to-end type safety
- All color tokens use lime-green (#CEFF00) as primary accent on near-black backgrounds
- DB enum constraint on `tools.category` prevents invalid data from breaking Zod response parsing
- Platform stats endpoint returns static values (update as platform grows)
- Waitlist uses unique constraint on email with 409 response for duplicates

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Marketing Studio

The `/marketing-studio` route uses its own full-screen layout — it bypasses the global Navbar/Footer (handled in `layout.tsx` by path check). The page renders a two-panel layout: a 220px left sidebar + main scrollable area with a sticky bottom generation bar.

Key files:
- `artifacts/higgsfield/src/pages/marketing-studio.tsx` — full self-contained layout with sidebar, dot-grid bg, template cards, sticky gen bar
- `artifacts/higgsfield/src/components/layout.tsx` — skips global chrome for `/marketing-studio*` paths

## Setup notes (imported project)

- Auth: Replit-managed Clerk is provisioned (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` secrets set). Frontend/backend Clerk wiring was already present in the imported code.
- DB: schema pushed with `pnpm --filter @workspace/db exec drizzle-kit push --config ./drizzle.config.ts`, then seeded with `pnpm --filter @workspace/db run seed` (tools/apps/pricing tables were empty on import).
- AI generation: `OPENROUTER_API_KEY` (prompt planning) and `WAVESPEED_API_KEY` (image/video generation) are set as user-provided BYOK secrets — this project intentionally bypasses Replit's AI Integrations proxy (see code comment in `artifacts/api-server/src/lib/llm/client.ts`).
- Billing: Razorpay (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`) is not configured — checkout/billing routes degrade gracefully (503 with a clear message) until real keys are added. Add them later if the user wants live billing.
- All three workflows (`higgsfield` web, `api-server`, `mockup-sandbox`) run cleanly after `pnpm install`. Note: secrets and DB data do not survive re-import into a fresh environment — re-check `checkClerkManagementStatus()`, DB row counts, and these env vars on any future fresh setup pass.
- Re-verified and re-provisioned on 2026-07-13 after a fresh re-import: Clerk keys, DB schema+seed, and OPENROUTER_API_KEY/WAVESPEED_API_KEY were all re-added from scratch. Razorpay remains unconfigured (degrades gracefully).
- Re-provisioned again later on 2026-07-13 after another fresh re-import wiped `node_modules`, Clerk keys, `OPENROUTER_API_KEY`/`WAVESPEED_API_KEY`, and DB tables: ran `pnpm install`, `setupClerkWhitelabelAuth()`, `drizzle-kit push`, and `pnpm --filter @workspace/db run seed`. All three workflows (higgsfield web, API Server, mockup-sandbox) verified running; homepage confirmed rendering with seeded data via screenshot.
- Re-provisioned on 2026-07-13 (another fresh import): `pnpm install`, `setupClerkWhitelabelAuth()`, `drizzle-kit push`, `pnpm --filter @workspace/db run seed`. DATABASE_URL was already present; `OPENROUTER_API_KEY`/`WAVESPEED_API_KEY` still need to be re-added by the user for AI generation. All three workflows running, homepage confirmed via screenshot.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run codegen before touching the frontend
- `tag` query param in `/tools` does a ILIKE search across name and tagline fields (no separate tags table)
- Tool detail page resolves slug → id by finding the tool in the list query, then calls `useGetTool(id)`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
