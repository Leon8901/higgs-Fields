/**
 * Phase 3 — WaveSpeed end-to-end live verification.
 *
 * Mints a real Clerk session, submits a generation through the full API stack
 * (auth → credit charge → adapter → DB), polls until complete, reports trace.
 *
 * Run from api-server dir:
 *   pnpm exec tsx src/scripts/verify-wavespeed.mts
 */

import { clerkClient } from "@clerk/express";

const API_BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const CLERK_USER_ID = "user_3GRuOyTkXrdBu2m4gA4ExOtf5uF";

// Cheapest seeded WaveSpeed model: seedream-v5-lite at creditCost=1 (~$0.035).
const MODEL_ID = "seedream-v5-lite";
const PROMPT = "a neon-lit rainy street at night, cinematic";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 36; // 3-minute ceiling

async function mintJwt(): Promise<{ jwt: string; sessionId: string }> {
  const session = await clerkClient.sessions.createSession({ userId: CLERK_USER_ID });
  const { jwt } = await clerkClient.sessions.getToken(session.id, undefined as any);
  console.log(`[auth] Session ${session.id} created — JWT obtained`);
  return { jwt, sessionId: session.id };
}

async function apiPost(path: string, jwt: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function apiGet(path: string, jwt: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function main() {
  console.log("=".repeat(64));
  console.log("Phase 3 — WaveSpeed live verification");
  console.log("=".repeat(64));

  let sessionId: string | null = null;
  let jwt: string | null = null;

  try {
    ({ jwt, sessionId } = await mintJwt());

    // ── Step 1: Credit balance before ────────────────────────────────────
    const meBefore = await apiGet("/api/me", jwt);
    console.log(`\n[credits] Before: HTTP ${meBefore.status}`, JSON.stringify(meBefore.data));

    // ── Step 2: Submit generation ─────────────────────────────────────────
    console.log(`\n[submit] POST /api/generations — model=${MODEL_ID}`);
    console.log(`         prompt="${PROMPT}"`);

    const submit = await apiPost("/api/generations", jwt, {
      modelId: MODEL_ID,
      prompt: PROMPT,
      params: { aspect_ratio: "16:9" },
      useOwnKey: false,
    });

    console.log(`[submit] HTTP ${submit.status}`);
    console.log(JSON.stringify(submit.data, null, 2));

    const genId: number | undefined = submit.data?.generation?.id;
    if (!genId) {
      console.error("[submit] FAILED — no generation ID returned. Aborting.");
      return;
    }
    console.log(`\n[submit] Generation ID: ${genId}`);

    // ── Step 3: Poll until terminal state ─────────────────────────────────
    let lastStatus = "pending";
    let finalGen: any = null;

    for (let i = 1; i <= MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data } = await apiGet(`/api/generations/${genId}`, jwt);
      const gen = data?.generation;
      const status = gen?.status ?? "unknown";

      if (status !== lastStatus) {
        console.log(`[poll #${i}] status: ${status}`);
        if (gen?.outputUrls?.length) console.log(`           outputUrls: ${JSON.stringify(gen.outputUrls)}`);
        lastStatus = status;
      } else {
        process.stdout.write(`[poll #${i}] ${status}...\r`);
      }

      if (status === "completed" || status === "failed") {
        finalGen = gen;
        break;
      }
    }

    if (!finalGen) {
      console.error(`\n[timeout] Still "${lastStatus}" after ${MAX_POLLS} polls.`);
    } else {
      console.log("\n\n[result] Final generation record:");
      console.log(JSON.stringify(finalGen, null, 2));
    }

    // ── Step 4: Credit balance after ─────────────────────────────────────
    const meAfter = await apiGet("/api/me", jwt);
    console.log(`\n[credits] After: HTTP ${meAfter.status}`, JSON.stringify(meAfter.data));

  } finally {
    if (sessionId) {
      await clerkClient.sessions.revokeSession(sessionId);
      console.log(`\n[auth] Session ${sessionId} revoked`);
    }
    console.log("\n" + "=".repeat(64));
    console.log("Verification complete.");
    console.log("=".repeat(64));
  }
}

main().catch(console.error);
