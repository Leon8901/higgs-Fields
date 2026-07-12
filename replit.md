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
- `artifacts/higgsfield/src/pages/` — React pages (home, tools, tool-detail, apps, pricing)
- `artifacts/higgsfield/src/index.css` — design tokens and theme (dark mode, lime-green accent)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)

## Pages

- `/` — Homepage with hero, featured tools, app gallery, platform stats, waitlist CTA
- `/tools` — Full tools catalog with category filter tabs (All/Image/Video/Audio)
- `/tools/:slug` — Individual tool detail page
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

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run codegen before touching the frontend
- `tag` query param in `/tools` does a ILIKE search across name and tagline fields (no separate tags table)
- Tool detail page resolves slug → id by finding the tool in the list query, then calls `useGetTool(id)`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
