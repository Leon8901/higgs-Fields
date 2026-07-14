/**
 * Phase 3 — WaveSpeed end-to-end live verification.
 *
 * Mints a real Clerk session for the dev user, submits a generation through
 * the full API stack (auth → credit charge → adapter → DB), polls until
 * complete, and reports the full trace.
 *
 * Run from repo root:
 *   pnpm --filter @workspace/api-server exec tsx ../../scripts/verify-wavespeed.mts
 */

import { clerkClient } from "@clerk/express";

const API_BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const CLERK_USER_ID = "user_3GRuOyTkXrdBu2m4gA4ExOtf5uF";

// Cheapest seeded WaveSpeed model: seedream-v5-lite at creditCost=1 (~$0.035).
const MODEL_ID = "seedream-v5-lite";
const PROMPT = "a neon-lit rainy street at night, cinematic";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 30; // 2-minute ceiling

async function mintJwt(): Promise<string> {
  const session = await clerkClient.sessions.createSession({ userId: CLERK_USER_ID });
  // @clerk/express getToken accepts undefined as the second argument for the
  // default short-lived JWT template.
  const { jwt } = await clerkClient.sessions.getToken(session.id, undefined as any);
  console.log(`[auth] Session ${session.id} minted — JWT obtained`);
  return jwt;
}

async function revokeSession(jwt: string): Promise<void> {
  // Extract session ID from JWT payload (second segment, base64url).
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    await clerkClient.sessions.revokeSession(payload.sid);
    console.log(`[auth] Session ${payload.sid} revoked`);
  } catch {
    console.warn("[auth] Could not revoke session — clean up manually if needed");
  }
}

async function apiPost(path: string, jwt: string, body: unknown): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function apiGet(path: string, jwt: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Phase 3 — WaveSpeed live verification");
  console.log("=".repeat(60));

  let jwt: string | null = null;
  try {
    jwt = await mintJwt();

    // ── Step 1: Check credit balance before generation ────────────────────
    const me = await apiGet("/api/me", jwt);
    console.log(`\n[credits] Before: ${JSON.stringify(me.data)}`);

    // ── Step 2: Submit generation ─────────────────────────────────────────
    console.log(`\n[submit] POST /api/generations — model=${MODEL_ID}, prompt="${PROMPT}"`);
    const submit = await apiPost("/api/generations", jwt, {
      modelId: MODEL_ID,
      prompt: PROMPT,
      params: { aspect_ratio: "16:9" },
      useOwnKey: false,
    });
    console.log(`[submit] HTTP ${submit.status} →`, JSON.stringify(submit.data, null, 2));

    if (!submit.data?.generation?.id) {
      console.error("[submit] FAILED — no generation ID in response. Aborting.");
      return;
    }

    const genId = submit.data.generation.id;
    console.log(`[submit] Generation ID: ${genId}`);

    // ── Step 3: Poll until terminal state ─────────────────────────────────
    let lastStatus = "pending";
    let pollCount = 0;

    while (pollCount < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;

      const poll = await apiGet(`/api/generations/${genId}`, jwt);
      const gen = poll.data?.generation;
      const newStatus = gen?.status ?? "?";
      const changed = newStatus !== lastStatus;
      lastStatus = newStatus;

      if (changed) {
        console.log(`[poll #${pollCount}] status: ${newStatus} | outputUrls: ${JSON.stringify(gen?.outputUrls ?? [])}`);
      } else {
        process.stdout.write(`[poll #${pollCount}] ${newStatus}...\r`);
      }

      if (newStatus === "completed" || newStatus === "failed") {
        console.log("\n");
        console.log("[result] Final generation record:");
        console.log(JSON.stringify(gen, null, 2));
        break;
      }
    }

    if (lastStatus !== "completed" && lastStatus !== "failed") {
      console.error(`[timeout] Still "${lastStatus}" after ${pollCount} polls. Check background poller.`);
    }

    // ── Step 4: Credit ledger after ───────────────────────────────────────
    const meAfter = await apiGet("/api/me", jwt);
    console.log(`\n[credits] After:  ${JSON.stringify(meAfter.data)}`);

  } finally {
    if (jwt) await revokeSession(jwt);
    console.log("\n" + "=".repeat(60));
    console.log("Verification complete.");
    console.log("=".repeat(60));
  }
}

main().catch(console.error);
