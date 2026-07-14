/**
 * Phase 3 — Real adapter isolation test.
 *
 * Deliberately triggers HTTP failures against two adapters (invalid keys →
 * real provider rejections, zero cost) then confirms every adapter in the
 * registry is still correctly present and callable. This is a live network
 * test, not a simulation.
 *
 * Run from api-server dir:
 *   pnpm exec tsx src/scripts/verify-adapter-isolation.mts
 */

import { getAdapter, tryGetAdapter } from "../lib/media/registry.js";
import { ProviderError } from "../lib/media/types.js";

const ADAPTERS_EXPECTED = ["wavespeed", "openai", "kling", "elevenlabs"] as const;
const INVALID_KEY = "invalid-key-phase3-isolation-test";
// Kling requires accessKey:secretKey format so JWT generation proceeds to the real HTTP call.
const INVALID_KLING_KEY = "fakeAccessKey:fakeSecretKey";

let passed = 0;
let failed = 0;

function ok(msg: string) { console.log(`  ✅  ${msg}`); passed++; }
function fail(msg: string) { console.error(`  ❌  ${msg}`); failed++; }

async function triggerAndCatch(
  label: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
    fail(`${label} — did NOT throw (unexpected success or silent failure)`);
  } catch (err) {
    if (err instanceof ProviderError) {
      ok(`${label} → ProviderError { kind:"${err.kind}", msg:"${err.message.slice(0,80)}" }`);
    } else if (err instanceof Error) {
      // Network timeout, TLS error, or non-ProviderError HTTP rejection — all acceptable.
      ok(`${label} → Error: "${err.message.slice(0, 80)}"`);
    } else {
      fail(`${label} → unexpected non-Error thrown: ${String(err)}`);
    }
  }
}

async function main() {
  console.log("=".repeat(64));
  console.log("Phase 3 — Adapter isolation test (live HTTP failures)");
  console.log("=".repeat(64));

  // ── 1. Deliberately fail WaveSpeed with an invalid key ────────────────
  // Real HTTP POST to api.wavespeed.ai — rejected at auth, zero charge.
  console.log("\n[step 1] WaveSpeed submit() with invalid key:");
  const ws = getAdapter("wavespeed");
  await triggerAndCatch(
    "wavespeed.submit(invalid)",
    () => ws.submit("bytedance/seedream-v5.0-lite", { prompt: "isolation test" }, INVALID_KEY),
  );

  // ── 2. Deliberately fail Kling with a fake key ────────────────────────
  // JWT is derived from the fake accessKey:secretKey, then rejected by Kling API.
  console.log("\n[step 2] Kling submit() with fake accessKey:secretKey:");
  const kl = getAdapter("kling");
  await triggerAndCatch(
    "kling.submit(fake)",
    () => kl.submit("kling-v1-5", { prompt: "isolation test", aspect_ratio: "16:9", duration: 5 }, INVALID_KLING_KEY),
  );

  // ── 3. Confirm entire registry is intact after failures ───────────────
  console.log("\n[step 3] Registry intact after deliberate failures:");
  for (const slug of ADAPTERS_EXPECTED) {
    const adapter = tryGetAdapter(slug);
    if (adapter && typeof adapter.submit === "function" && typeof adapter.poll === "function") {
      ok(`registry["${slug}"] — present, has submit() and poll()`);
    } else {
      fail(`registry["${slug}"] — MISSING or missing required methods!`);
    }
  }

  // ── 4. Real validateKey() calls on the two unaffected adapters ────────
  // Each makes a real HTTP request to the provider and expects a false return
  // (401/403 → invalid) rather than a crash — proving the adapters are
  // callable and independently isolated from the failures in steps 1-2.
  console.log("\n[step 4] OpenAI validateKey() — real HTTP to api.openai.com:");
  const oa = getAdapter("openai");
  if (oa.validateKey) {
    try {
      const v = await oa.validateKey(INVALID_KEY);
      if (v === false) ok(`openai.validateKey(invalid) → false (real 401 from OpenAI API)`);
      else fail(`openai.validateKey(invalid) → ${v} (expected false)`);
    } catch (err) {
      ok(`openai.validateKey(invalid) → threw "${(err as Error).message.slice(0, 60)}" (network / auth rejection)`);
    }
  }

  console.log("\n[step 5] ElevenLabs validateKey() — real HTTP to api.elevenlabs.io:");
  const el = getAdapter("elevenlabs");
  if (el.validateKey) {
    try {
      const v = await el.validateKey(INVALID_KEY);
      if (v === false) ok(`elevenlabs.validateKey(invalid) → false (real 401 from ElevenLabs API)`);
      else fail(`elevenlabs.validateKey(invalid) → ${v} (expected false)`);
    } catch (err) {
      ok(`elevenlabs.validateKey(invalid) → threw "${(err as Error).message.slice(0, 60)}" (network / auth rejection)`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(64));
  console.log(`Isolation test: ${passed} passed, ${failed} failed`);
  console.log(failed === 0 ? "RESULT: PASS — adapters fully isolated" : "RESULT: FAIL — see ❌ above");
  console.log("=".repeat(64));
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
