// One-off backfill script: generates a real representative thumbnail image
// for every tool/model that doesn't have one yet, plus one hero background
// image for the homepage. Run with:
//   pnpm --filter @workspace/db run seed-thumbnails
//
// Uses WaveSpeedAI directly (same provider the app already uses at runtime)
// with the cheapest image model (seedream-v5-lite) for per-tool thumbnails,
// and seedream-v5-pro for the single hero image. Safe to re-run: any tool
// that already has a thumbnailUrl is skipped.
import { db } from "./src/index";
import { modelsTable, toolsTable } from "./src/schema";
import { eq, isNull } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://api.wavespeed.ai/api/v3";
const THUMBNAIL_MODEL_PATH = "bytedance/seedream-v5.0-lite";
const HERO_MODEL_PATH = "bytedance/seedream-v5.0-pro";

const apiKey = process.env.WAVESPEED_API_KEY;
if (!apiKey) {
  console.error("WAVESPEED_API_KEY is not set.");
  process.exit(1);
}

// Tailored prompt per tool so the thumbnail actually looks like what that
// tool produces, rather than 13 near-identical images.
const THUMBNAIL_PROMPTS: Record<string, string> = {
  "nano-banana-pro-ultra": "Ultra-detailed cinematic portrait of a woman in golden hour light, hyper-realistic skin texture, shallow depth of field, professional photography",
  "nano-banana-pro-edit": "Before and after style product photo of a sneaker being relit and recomposed on a studio pedestal with dramatic rim lighting",
  "nano-banana-2": "Vibrant modern still life of a coffee cup on a marble table with soft window light and bokeh background",
  "seedream-v5-pro": "Professional architectural photo of a minimalist glass house at dusk, clean composition, production-ready quality",
  "seedream-v5-lite": "Quick concept sketch of a futuristic city skyline at sunset, bold colors, fast iteration style",
  "seedance-2-0": "Cinematic film still of a lone astronaut walking across a red Martian dune, dramatic wide shot, movie-quality lighting",
  "seedance-2-0-fast": "Dynamic action film still of a sports car drifting around a neon-lit city corner at night, motion blur",
  "kling-v3-std": "Smooth cinematic still of ocean waves crashing on a rocky coastline at sunrise, natural motion",
  "kling-v3-pro": "Sharp, richly detailed film still of a dancer mid-spin on stage under colorful spotlights",
  "veo-3-1": "State-of-the-art cinematic still of a orchestra performing in a grand concert hall, rich atmosphere, film-quality detail",
  "sora-2": "Physically realistic film still of a paper airplane gliding through a sunlit office, soft shadows",
  "wan-2-2-image-to-video": "Still frame of a painted portrait subtly coming to life, first frame of an animation, soft motion cue",
  "seed-audio-1-0": "Abstract art of a glowing voice waveform and soundwave visualization on a dark studio background, audio production aesthetic",
};

const HERO_PROMPT = "Epic cinematic composite of glowing abstract light trails, film reels, and generative art forms swirling together on a dark background, moody lime-green and black color palette, ultra high production value, wide banner composition";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submit(providerModelPath: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/${providerModelPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: "1:1" }),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Submit failed with status ${res.status}`);
  }
  const taskId = body?.data?.id;
  if (!taskId) throw new Error("Submit response missing task id.");
  return taskId;
}

async function pollUntilDone(taskId: string, label: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await fetch(`${BASE_URL}/predictions/${taskId}/result`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.message || body?.error || `Poll failed with status ${res.status}`);
    }
    const status = body?.data?.status;
    if (status === "completed") {
      const outputs: string[] = Array.isArray(body?.data?.outputs) ? body.data.outputs : [];
      if (outputs.length === 0) throw new Error(`${label}: completed with no outputs`);
      return outputs[0];
    }
    if (status === "failed") {
      throw new Error(`${label}: generation failed — ${body?.data?.error || "unknown error"}`);
    }
    await sleep(3000);
  }
  throw new Error(`${label}: timed out waiting for completion`);
}

async function generateImage(providerModelPath: string, prompt: string, label: string): Promise<string> {
  console.log(`Submitting ${label}...`);
  const taskId = await submit(providerModelPath, prompt);
  console.log(`  task ${taskId} submitted, polling...`);
  const url = await pollUntilDone(taskId, label);
  console.log(`  done: ${url}`);
  return url;
}

async function main() {
  const modelsNeedingThumbnails = await db
    .select()
    .from(modelsTable)
    .where(isNull(modelsTable.thumbnailUrl));

  console.log(`${modelsNeedingThumbnails.length} model(s) missing a thumbnail.`);

  for (const model of modelsNeedingThumbnails) {
    const prompt = THUMBNAIL_PROMPTS[model.modelId];
    if (!prompt) {
      console.warn(`No prompt configured for ${model.modelId}, skipping.`);
      continue;
    }
    try {
      const url = await generateImage(THUMBNAIL_MODEL_PATH, prompt, model.modelId);
      await db.update(modelsTable).set({ thumbnailUrl: url }).where(eq(modelsTable.id, model.id));
      await db.update(toolsTable).set({ thumbnailUrl: url }).where(eq(toolsTable.slug, model.modelId));
      console.log(`Saved thumbnail for ${model.modelId}`);
    } catch (err) {
      console.error(`Failed to generate thumbnail for ${model.modelId}:`, err);
    }
  }

  console.log("Generating hero background image...");
  try {
    const heroUrl = await generateImage(HERO_MODEL_PATH, HERO_PROMPT, "hero-background");
    const outPath = path.resolve(
      __dirname,
      "../../artifacts/higgsfield/src/config/hero-image.ts",
    );
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      `// Generated by lib/db/seed-thumbnails.ts — do not hand-edit the URL.\nexport const HERO_IMAGE_URL = ${JSON.stringify(heroUrl)};\n`,
    );
    console.log(`Wrote hero image config to ${outPath}`);
  } catch (err) {
    console.error("Failed to generate hero image:", err);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
