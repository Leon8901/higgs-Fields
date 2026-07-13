// One-off data seed for the Higgsfield AI clone. Run with:
//   pnpm --filter @workspace/db run seed
// Safe to re-run: each section upserts on its natural unique key.
import { db } from "./src/index";
import { toolsTable, modelsTable, pricingPlansTable, appsTable, creditPacksTable, providersTable } from "./src/schema";
import { sql } from "drizzle-orm";

type ParamField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "toggle" | "image";
  options?: string[];
  default?: unknown;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  helpText?: string | null;
};

const ASPECT_RATIO: ParamField = {
  key: "aspect_ratio",
  label: "Aspect ratio",
  type: "select",
  options: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  default: "16:9",
};

const RESOLUTION_IMG: ParamField = {
  key: "resolution",
  label: "Resolution",
  type: "select",
  options: ["1K", "2K", "4K"],
  default: "2K",
};

const RESOLUTION_VID: ParamField = {
  key: "resolution",
  label: "Resolution",
  type: "select",
  options: ["480p", "720p", "1080p"],
  default: "1080p",
};

const DURATION = (options: string[], def: string): ParamField => ({
  key: "duration",
  label: "Duration (seconds)",
  type: "select",
  options,
  default: def,
});

const IMAGE_INPUT: ParamField = {
  key: "image",
  label: "Reference image",
  type: "image",
  required: true,
  helpText: "Upload the image to edit or animate.",
};

// ── Generation model catalog ────────────────────────────────────────────────
// Real WaveSpeedAI model ids + base prices, converted to platform credits at
// a $0.05-per-credit cost basis: creditCost = ceil(base_price / 0.05).
const models: Array<{
  modelId: string;
  name: string;
  category: "image" | "video" | "audio";
  description: string;
  badge: string | null;
  isFeatured: boolean;
  sortOrder: number;
  adapter: string;
  providerModelPath: string;
  basePriceUsd: number;
  creditCost: number;
  fields: ParamField[];
}> = [
  {
    modelId: "nano-banana-pro-ultra",
    name: "Nano Banana Pro Ultra",
    category: "image",
    description: "Google's flagship text-to-image model, tuned for ultra-high-fidelity detail and prompt adherence.",
    badge: "NEW",
    isFeatured: true,
    sortOrder: 1,
    adapter: "wavespeed",
    providerModelPath: "google/nano-banana-pro/text-to-image-ultra",
    basePriceUsd: 0.15,
    creditCost: 3,
    fields: [ASPECT_RATIO, RESOLUTION_IMG],
  },
  {
    modelId: "nano-banana-pro-edit",
    name: "Nano Banana Pro Edit",
    category: "image",
    description: "Precision image editing — retouch, restyle, or recompose an existing image from a text instruction.",
    badge: "NEW",
    isFeatured: true,
    sortOrder: 2,
    adapter: "wavespeed",
    providerModelPath: "google/nano-banana-pro/edit",
    basePriceUsd: 0.14,
    creditCost: 3,
    fields: [IMAGE_INPUT, ASPECT_RATIO],
  },
  {
    modelId: "nano-banana-2",
    name: "Nano Banana 2",
    category: "image",
    description: "Fast, affordable text-to-image generation with strong composition and lighting quality.",
    badge: null,
    isFeatured: true,
    sortOrder: 3,
    adapter: "wavespeed",
    providerModelPath: "google/nano-banana-2/text-to-image",
    basePriceUsd: 0.07,
    creditCost: 2,
    fields: [ASPECT_RATIO, RESOLUTION_IMG],
  },
  {
    modelId: "seedream-v5-pro",
    name: "Seedream v5.0 Pro",
    category: "image",
    description: "ByteDance's professional-grade image model for clean, production-ready stills.",
    badge: null,
    isFeatured: false,
    sortOrder: 4,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seedream-v5.0-pro",
    basePriceUsd: 0.045,
    creditCost: 1,
    fields: [ASPECT_RATIO],
  },
  {
    modelId: "seedream-v5-lite",
    name: "Seedream v5.0 Lite",
    category: "image",
    description: "The fastest, cheapest way to turn a prompt into an image — great for rapid iteration.",
    badge: null,
    isFeatured: false,
    sortOrder: 5,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seedream-v5.0-lite",
    basePriceUsd: 0.035,
    creditCost: 1,
    fields: [ASPECT_RATIO],
  },
  {
    modelId: "seedance-2-0",
    name: "Seedance 2.0",
    category: "video",
    description: "ByteDance's flagship text-to-video model with cinematic motion and strong prompt following.",
    badge: "TRENDING",
    isFeatured: true,
    sortOrder: 6,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seedance-2.0/text-to-video",
    basePriceUsd: 0.6,
    creditCost: 12,
    fields: [ASPECT_RATIO, RESOLUTION_VID, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "seedance-2-0-fast",
    name: "Seedance 2.0 Fast",
    category: "video",
    description: "A faster, lower-cost variant of Seedance 2.0 for quick previews and iteration.",
    badge: null,
    isFeatured: false,
    sortOrder: 7,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seedance-2.0-fast/text-to-video",
    basePriceUsd: 0.5,
    creditCost: 10,
    fields: [ASPECT_RATIO, RESOLUTION_VID, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "kling-v3-std",
    name: "Kling v3.0 Standard",
    category: "video",
    description: "Kuaishou's Kling model, standard tier — smooth motion at an accessible price point.",
    badge: null,
    isFeatured: false,
    sortOrder: 8,
    adapter: "wavespeed",
    providerModelPath: "kwaivgi/kling-v3.0-std/text-to-video",
    basePriceUsd: 0.42,
    creditCost: 9,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "kling-v3-pro",
    name: "Kling v3.0 Pro",
    category: "video",
    description: "The professional tier of Kling v3.0, with sharper detail and more consistent motion.",
    badge: "HOT",
    isFeatured: true,
    sortOrder: 9,
    adapter: "wavespeed",
    providerModelPath: "kwaivgi/kling-v3.0-pro/text-to-video",
    basePriceUsd: 0.56,
    creditCost: 12,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "veo-3-1",
    name: "Veo 3.1",
    category: "video",
    description: "Google's state-of-the-art video model, with native synchronized audio generation.",
    badge: "HOT",
    isFeatured: true,
    sortOrder: 10,
    adapter: "wavespeed",
    providerModelPath: "google/veo3.1/text-to-video",
    basePriceUsd: 3.2,
    creditCost: 64,
    fields: [
      ASPECT_RATIO,
      RESOLUTION_VID,
      DURATION(["4", "6", "8"], "8"),
      { key: "generate_audio", label: "Generate audio", type: "toggle", default: true },
    ],
  },
  {
    modelId: "sora-2",
    name: "Sora 2",
    category: "video",
    description: "OpenAI's Sora 2 — expressive, physically-plausible text-to-video generation.",
    badge: "NEW",
    isFeatured: true,
    sortOrder: 11,
    adapter: "wavespeed",
    providerModelPath: "openai/sora-2/text-to-video",
    basePriceUsd: 0.4,
    creditCost: 8,
    fields: [ASPECT_RATIO, RESOLUTION_VID, DURATION(["4", "8", "12"], "8")],
  },
  {
    modelId: "wan-2-2-image-to-video",
    name: "WAN 2.2 Image to Video",
    category: "video",
    description: "Animate a still image into a short video clip, preserving subject and style.",
    badge: null,
    isFeatured: false,
    sortOrder: 12,
    adapter: "wavespeed",
    providerModelPath: "wavespeed-ai/wan-2.2/image-to-video",
    basePriceUsd: 0.15,
    creditCost: 3,
    fields: [IMAGE_INPUT, DURATION(["5"], "5")],
  },
  {
    modelId: "seed-audio-1-0",
    name: "Seed Audio 1.0",
    category: "audio",
    description: "Text-to-speech and sound generation with expressive, character-driven voices.",
    badge: "NEW",
    isFeatured: false,
    sortOrder: 13,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seed-audio-1.0",
    basePriceUsd: 0.3,
    creditCost: 6,
    fields: [
      { key: "characters", label: "Voice character", type: "select", options: ["Narrator", "Warm", "Energetic", "Calm"], default: "Narrator" },
      DURATION(["10", "30", "60"], "30"),
    ],
  },
];

const CATEGORY_GRADIENT: Record<string, string> = {
  image: "linear-gradient(135deg, #1a2e05 0%, #0a0a0a 100%)",
  video: "linear-gradient(135deg, #1a0a2e 0%, #0a0a0a 100%)",
  audio: "linear-gradient(135deg, #2e1a05 0%, #0a0a0a 100%)",
};

async function main() {
  console.log("Seeding models...");
  for (const m of models) {
    await db
      .insert(modelsTable)
      .values({
        modelId: m.modelId,
        name: m.name,
        category: m.category,
        description: m.description,
        badge: m.badge,
        isFeatured: m.isFeatured,
        sortOrder: m.sortOrder,
        adapter: m.adapter,
        providerModelPath: m.providerModelPath,
        basePriceUsd: m.basePriceUsd,
        creditCost: m.creditCost,
        paramsSchema: { fields: m.fields },
      })
      .onConflictDoUpdate({
        target: modelsTable.modelId,
        set: {
          name: m.name,
          category: m.category,
          description: m.description,
          badge: m.badge,
          isFeatured: m.isFeatured,
          sortOrder: m.sortOrder,
          adapter: m.adapter,
          providerModelPath: m.providerModelPath,
          basePriceUsd: m.basePriceUsd,
          creditCost: m.creditCost,
          paramsSchema: { fields: m.fields },
        },
      });
  }

  console.log("Seeding tools (marketing catalog, 1:1 with models)...");
  for (const m of models) {
    await db
      .insert(toolsTable)
      .values({
        name: m.name,
        slug: m.modelId,
        tagline: m.description.split(".")[0] + ".",
        description: m.description,
        category: m.category,
        badge: m.badge,
        isFeatured: m.isFeatured,
        gradient: CATEGORY_GRADIENT[m.category] ?? null,
        accentColor: "#CEFF00",
        sortOrder: m.sortOrder,
      })
      .onConflictDoUpdate({
        target: toolsTable.slug,
        set: {
          name: m.name,
          tagline: m.description.split(".")[0] + ".",
          description: m.description,
          category: m.category,
          badge: m.badge,
          isFeatured: m.isFeatured,
          gradient: CATEGORY_GRADIENT[m.category] ?? null,
          sortOrder: m.sortOrder,
        },
      });
  }

  console.log("Seeding pricing plans...");
  const plans = [
    {
      planKey: "starter",
      name: "Starter",
      price: 19,
      yearlyPrice: 19,
      creditsPerMonth: 270,
      description: "For creators just getting started with AI generation.",
      features: [
        "270 credits / month",
        "Access to all image models",
        "Access to fast-tier video models",
        "Standard generation queue",
        "Community gallery publishing",
      ],
      isPopular: false,
      ctaLabel: "Get Starter",
      sortOrder: 1,
    },
    {
      planKey: "plus",
      name: "Plus",
      price: 47,
      yearlyPrice: 47,
      creditsPerMonth: 1200,
      description: "For regular creators who need more volume and premium models.",
      features: [
        "1,200 credits / month",
        "Access to every model, including Veo 3.1 and Sora 2",
        "Priority generation queue",
        "Bring your own API key (BYOK)",
        "Community gallery publishing",
      ],
      isPopular: true,
      ctaLabel: "Get Plus",
      sortOrder: 2,
    },
    {
      planKey: "ultra",
      name: "Ultra",
      price: 99,
      yearlyPrice: 99,
      creditsPerMonth: 9000,
      description: "For studios and power users running high-volume production.",
      features: [
        "9,000 credits / month",
        "Access to every model at full resolution",
        "Highest-priority generation queue",
        "Bring your own API key (BYOK)",
        "Early access to new models",
      ],
      isPopular: false,
      ctaLabel: "Get Ultra",
      sortOrder: 3,
    },
  ];

  for (const p of plans) {
    await db
      .insert(pricingPlansTable)
      .values(p)
      .onConflictDoUpdate({ target: pricingPlansTable.planKey, set: p });
  }

  console.log("Seeding credit packs...");
  const creditPacks = [
    { packKey: "pack_small", name: "Small Pack", credits: 100, priceUsd: 9, isPopular: false, sortOrder: 1 },
    { packKey: "pack_medium", name: "Medium Pack", credits: 550, priceUsd: 39, isPopular: true, sortOrder: 2 },
    { packKey: "pack_large", name: "Large Pack", credits: 1500, priceUsd: 89, isPopular: false, sortOrder: 3 },
  ];

  for (const p of creditPacks) {
    await db
      .insert(creditPacksTable)
      .values(p)
      .onConflictDoUpdate({ target: creditPacksTable.packKey, set: p });
  }

  console.log("Seeding BYOK provider registry...");
  const providers = [
    {
      slug: "wavespeed",
      name: "WaveSpeed AI",
      icon: null,
      capabilities: ["image", "video", "audio"],
      supportsByok: true,
      keyFormatHint: "Find this in your WaveSpeed AI account settings.",
      status: "active",
    },
    {
      slug: "openrouter",
      name: "OpenRouter",
      icon: null,
      capabilities: ["text"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-or-",
      status: "active",
    },
    {
      slug: "kling",
      name: "Kling AI",
      icon: null,
      capabilities: ["video"],
      supportsByok: true,
      keyFormatHint: "Find this in your Kling AI account settings.",
      status: "active",
    },
    {
      slug: "google",
      name: "Google (Veo)",
      icon: null,
      capabilities: ["video", "image"],
      supportsByok: true,
      keyFormatHint: "Google AI Studio / Vertex AI API key.",
      status: "active",
    },
    {
      slug: "openai",
      name: "OpenAI",
      icon: null,
      capabilities: ["text", "image"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-",
      status: "active",
    },
    {
      slug: "anthropic",
      name: "Anthropic",
      icon: null,
      capabilities: ["text"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-ant-",
      status: "active",
    },
    {
      slug: "elevenlabs",
      name: "ElevenLabs",
      icon: null,
      capabilities: ["audio"],
      supportsByok: true,
      keyFormatHint: "Find this in your ElevenLabs account settings.",
      status: "active",
    },
    {
      slug: "fal",
      name: "fal.ai",
      icon: null,
      capabilities: ["image", "video"],
      supportsByok: true,
      keyFormatHint: "Format: <key_id>:<key_secret>",
      status: "active",
    },
  ];

  for (const p of providers) {
    await db
      .insert(providersTable)
      .values(p)
      .onConflictDoUpdate({ target: providersTable.slug, set: p });
  }

  console.log("Seeding community apps gallery...");
  const apps = [
    {
      name: "Dreamscape Trailer Studio",
      description: "A generative pipeline that turns a one-line pitch into a full cinematic movie trailer with score.",
      authorName: "Mira Chen",
      isFeatured: true,
      isTrending: true,
      isNew: false,
      viewCount: 18420,
      gradient: CATEGORY_GRADIENT.video,
    },
    {
      name: "Product Shot Anywhere",
      description: "Drop in a product photo and place it in any scene, lighting, and angle using Nano Banana Pro Edit.",
      authorName: "Theo Larsen",
      isFeatured: true,
      isTrending: false,
      isNew: true,
      viewCount: 9310,
      gradient: CATEGORY_GRADIENT.image,
    },
    {
      name: "Podcast Voice Cloner",
      description: "Generate narrated podcast intros with Seed Audio 1.0's character voices.",
      authorName: "Priya Nair",
      isFeatured: false,
      isTrending: true,
      isNew: false,
      viewCount: 5210,
      gradient: CATEGORY_GRADIENT.audio,
    },
    {
      name: "Storyboard to Motion",
      description: "Upload rough storyboard frames and animate each panel into a short video with WAN 2.2.",
      authorName: "Diego Alvarez",
      isFeatured: false,
      isTrending: false,
      isNew: true,
      viewCount: 2114,
      gradient: CATEGORY_GRADIENT.video,
    },
    {
      name: "Album Art Generator",
      description: "A community favorite for generating cohesive album art sets with Seedream v5.0.",
      authorName: "Jonas Weber",
      isFeatured: false,
      isTrending: false,
      isNew: false,
      viewCount: 12890,
      gradient: CATEGORY_GRADIENT.image,
    },
    {
      name: "Ad Concept Sandbox",
      description: "Rapidly prototype 15-second ad concepts across five aspect ratios at once.",
      authorName: "Aiko Tanaka",
      isFeatured: true,
      isTrending: false,
      isNew: false,
      viewCount: 7654,
      gradient: CATEGORY_GRADIENT.video,
    },
  ];

  for (const a of apps) {
    const exists = await db.execute(sql`select 1 from apps where name = ${a.name} limit 1`);
    if (exists.rows.length === 0) {
      await db.insert(appsTable).values(a);
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
