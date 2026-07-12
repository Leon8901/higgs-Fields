---
name: Imported pnpm-workspace app setup checklist
description: Common non-code reasons a freshly imported pnpm-workspace app 500s even though the code is already correct.
---

When an imported project's code already has Clerk/DB wiring in place but the app 500s after `pnpm install` + workflow restart, the cause is usually missing runtime setup, not a code bug:

- **Missing Clerk keys**: `checkClerkManagementStatus()` returns `not_configured` even if `@clerk/express`/`@clerk/react` code is fully wired. Run `setupClerkWhitelabelAuth()` to provision `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY`, then restart the API + frontend workflows.
- **Empty database**: `DATABASE_URL` being set doesn't mean tables have data. Check for a `lib/db` (or similar) package with `push` and `seed` scripts in its `package.json` — run schema push (`drizzle-kit push`) then the seed script before assuming an API 500 is a real bug.

**Why:** Both failure modes look identical from the browser (generic 500s / failed queries) and neither requires touching application code, so it's easy to mistake them for real bugs and start debugging the wrong thing.

**How to apply:** On any freshly imported project, after getting workflows running, check Clerk status and DB row counts before diagnosing API errors as code issues.

- **Secrets don't survive re-import/re-clone**: even if `replit.md` documents that Clerk/DB/other secrets were provisioned in a prior session, re-check `checkClerkManagementStatus()` and `env` on every fresh setup pass — a project can be re-imported into a new environment where those secrets are gone even though the code and docs still describe them as configured.
- **Check for other unconfigured paid integrations too**: grep for other third-party SDKs wired into server code (e.g. payment providers, LLM clients) whose secrets aren't in the current env — these are silent 500s waiting to happen, distinct from Clerk/DB. Worth a `incomplete_scope` follow-up rather than silently leaving them broken.
