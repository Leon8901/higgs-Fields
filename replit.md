# Higgsfield AI — Marketing Studio Clone

A full-stack AI media generation platform (Higgsfield clone) with image, video, and audio generation, BYOK (Bring Your Own Key) provider support, Clerk auth, and a Razorpay billing integration.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4 + Wouter, at `artifacts/higgsfield`
- **Backend**: Express + Clerk + Drizzle ORM, at `artifacts/api-server`
- **Database**: Replit PostgreSQL (Drizzle schema push + seed)
- **Auth**: Replit-managed Clerk (provisioned — uses `pk_test` keys in dev, auto-swaps to `pk_live` on publish)
- **AI**: OpenRouter (LLM/prompt building) + WaveSpeed (image/video generation)
- **Storage**: Replit Object Storage (bucket `replit-objstore-d446f8aa-48c2-473e-839c-152e50235866`)

## Running the project

All three workflows start automatically:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/higgsfield: web` | `pnpm --filter @workspace/higgsfield run dev` | 25131 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | 8081 |

## Database

To push schema changes: `pnpm --filter @workspace/db run push`  
To re-seed data: `pnpm --filter @workspace/db run seed`

## Required Secrets

| Secret | Purpose |
|---|---|
| `CLERK_SECRET_KEY` | Clerk server-side auth (Replit-managed) |
| `CLERK_PUBLISHABLE_KEY` | Clerk shared key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `OPENROUTER_API_KEY` | LLM prompt planner |
| `WAVESPEED_API_KEY` | Image/video generation |
| `SESSION_SECRET` | Express session signing |

Optional (billing degrades gracefully without them):
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

## User preferences

- Keep existing project structure and stack — do not restructure or migrate.
