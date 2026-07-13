#!/usr/bin/env bash
# setup.sh — one-command setup for a fresh import or new Replit environment.
#
# Run this whenever node_modules are missing or env vars have been wiped
# (e.g. after cloning into a new repl or a fresh re-import from GitHub).
#
# Usage:
#   bash setup.sh
#
# What it does:
#   1. Installs all pnpm workspace dependencies
#   2. Pushes the Drizzle DB schema (idempotent — safe to re-run)
#   3. Seeds the database if tables are empty
#
# What it does NOT do automatically (requires the Replit platform sandbox):
#   - Clerk auth setup  → call setupClerkWhitelabelAuth() in the Agent sandbox
#   - Object storage    → call setupObjectStorage()        in the Agent sandbox
#   - AI/billing keys   → set OPENROUTER_API_KEY, WAVESPEED_API_KEY manually
#
# After running this script, ask the agent to "finish setup" and it will
# provision Clerk + Object Storage via the platform callbacks.

set -e

echo "==> Installing dependencies..."
pnpm install

echo "==> Pushing DB schema..."
pnpm --filter @workspace/db exec drizzle-kit push --config ./drizzle.config.ts

echo "==> Seeding database..."
pnpm --filter @workspace/db run seed

echo ""
echo "✓ Done. Dependencies installed, DB schema pushed, DB seeded."
echo ""
echo "Next: ask the agent to run setupClerkWhitelabelAuth() and setupObjectStorage()"
echo "to provision auth and file storage, then restart the workflows."
