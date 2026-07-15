// One-off data seed for the Higgsfield AI clone. Run with:
//   pnpm --filter @workspace/db run seed
// Safe to re-run: each section upserts on its natural unique key.
import { db } from "./src/index";
import {
  toolsTable,
  modelsTable,
  pricingPlansTable,
  appsTable,
  creditPacksTable,
  providersTable,
  siteSettingsTable,
  settingsMetaTable,
} from "./src/schema";
import { sql } from "drizzle-orm";
import { SETTINGS_REGISTRY } from "./src/settingsRegistry";

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

  // ── Catalog expansion (verified against WaveSpeed's live model catalog,
  // audited 2026-07-14 — see chat for the full Bucket A/B/C/D report) ───────
  {
    modelId: "gpt-image-2",
    name: "GPT Image 2",
    category: "image",
    description: "OpenAI's latest image model — 4K output with near-perfect text rendering, via WaveSpeed.",
    badge: "NEW",
    isFeatured: false,
    sortOrder: 14,
    adapter: "wavespeed",
    providerModelPath: "openai/gpt-image-2/text-to-image",
    basePriceUsd: 0.06,
    creditCost: 2,
    fields: [
      ASPECT_RATIO,
      RESOLUTION_IMG,
      { key: "quality", label: "Quality", type: "select", options: ["low", "medium", "high"], default: "medium" },
      { key: "output_format", label: "Output format", type: "select", options: ["png", "jpeg", "webp"], default: "png" },
    ],
  },
  {
    modelId: "gpt-image-1-5",
    name: "GPT Image 1.5",
    category: "image",
    description: "OpenAI's fast, cost-efficient text-to-image generator with true-color precision rendering.",
    badge: null,
    isFeatured: false,
    sortOrder: 15,
    adapter: "wavespeed",
    providerModelPath: "openai/gpt-image-1.5/text-to-image",
    basePriceUsd: 0.14,
    creditCost: 3,
    fields: [
      { key: "size", label: "Size", type: "select", options: ["1024*1024", "1024*1536", "1536*1024"], default: "1024*1024" },
      { key: "quality", label: "Quality", type: "select", options: ["low", "medium", "high"], default: "medium" },
      { key: "output_format", label: "Output format", type: "select", options: ["jpeg", "png"], default: "jpeg" },
    ],
  },
  {
    modelId: "nano-banana-2-lite",
    name: "Nano Banana 2 Lite",
    category: "image",
    description: "Google's lightweight Nano Banana 2 tier — near-instant generation at a fraction of the cost.",
    badge: "NEW",
    isFeatured: false,
    sortOrder: 16,
    adapter: "wavespeed",
    providerModelPath: "google/nano-banana-2-lite/text-to-image",
    basePriceUsd: 0.034,
    creditCost: 1,
    fields: [ASPECT_RATIO],
  },
  {
    modelId: "nano-banana-pro",
    name: "Nano Banana Pro",
    category: "image",
    description: "Google's Gemini 3 Pro Image model — Higgsfield's best 4K image model, standard tier.",
    badge: "TOP",
    isFeatured: true,
    sortOrder: 17,
    adapter: "wavespeed",
    providerModelPath: "google/nano-banana-pro/text-to-image",
    basePriceUsd: 0.1,
    creditCost: 2,
    fields: [ASPECT_RATIO, RESOLUTION_IMG],
  },
  {
    modelId: "recraft-v4-1",
    name: "Recraft V4.1",
    category: "image",
    description: "Photorealistic and expressive image generation from Recraft, with strong design/vector fidelity.",
    badge: null,
    isFeatured: false,
    sortOrder: 18,
    adapter: "wavespeed",
    providerModelPath: "recraft-ai/recraft-v4.1/text-to-image",
    basePriceUsd: 0.04,
    creditCost: 1,
    fields: [
      ASPECT_RATIO,
      { key: "style", label: "Style", type: "select", options: ["realistic_image", "digital_illustration", "vector_illustration"], default: "realistic_image" },
    ],
  },
  {
    modelId: "grok-imagine-image",
    name: "Grok Imagine",
    category: "image",
    description: "xAI's Grok Imagine — versatile image styles, from photoreal to stylized illustration.",
    badge: null,
    isFeatured: false,
    sortOrder: 19,
    adapter: "wavespeed",
    providerModelPath: "x-ai/grok-imagine-image/text-to-image",
    basePriceUsd: 0.05,
    creditCost: 1,
    fields: [ASPECT_RATIO],
  },
  {
    modelId: "flux-2-pro",
    name: "FLUX.2",
    category: "image",
    description: "Black Forest Labs' FLUX.2 — production-grade realism, sharp text rendering, speed-optimized detail.",
    badge: null,
    isFeatured: false,
    sortOrder: 20,
    adapter: "wavespeed",
    providerModelPath: "wavespeed-ai/flux-2-pro/text-to-image",
    basePriceUsd: 0.05,
    creditCost: 1,
    fields: [ASPECT_RATIO, { key: "output_format", label: "Output format", type: "select", options: ["png", "jpeg", "webp"], default: "png" }],
  },
  {
    modelId: "z-image-turbo",
    name: "Z-Image",
    category: "image",
    description: "A 6B-parameter text-to-image model that renders photorealistic, lifelike portraits in sub-second time.",
    badge: null,
    isFeatured: false,
    sortOrder: 21,
    adapter: "wavespeed",
    providerModelPath: "wavespeed-ai/z-image/turbo",
    basePriceUsd: 0.02,
    creditCost: 1,
    fields: [ASPECT_RATIO],
  },
  {
    modelId: "seedance-v1-5-pro",
    name: "Seedance 1.5 Pro",
    category: "video",
    description: "ByteDance's Seedance 1.5 Pro — pro-grade audio-visual sync at an affordable price point.",
    badge: null,
    isFeatured: false,
    sortOrder: 22,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seedance-v1.5-pro/text-to-video",
    basePriceUsd: 0.45,
    creditCost: 9,
    fields: [ASPECT_RATIO, RESOLUTION_VID, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "gemini-omni-flash",
    name: "Gemini Omni Flash",
    category: "video",
    description: "Google's Gemini Omni Flash — generate video from any input, fast and low-cost.",
    badge: null,
    isFeatured: false,
    sortOrder: 23,
    adapter: "wavespeed",
    providerModelPath: "google/gemini-omni-flash/text-to-video",
    basePriceUsd: 0.5,
    creditCost: 10,
    fields: [ASPECT_RATIO, DURATION(["4", "8"], "8")],
  },
  {
    modelId: "kling-v3-turbo-std",
    name: "Kling 3.0 Turbo",
    category: "video",
    description: "A faster tier of Kling 3.0 with native synchronized audio generation.",
    badge: null,
    isFeatured: false,
    sortOrder: 24,
    adapter: "wavespeed",
    providerModelPath: "kwaivgi/kling-v3-turbo-std/text-to-video",
    basePriceUsd: 0.4,
    creditCost: 8,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "veo-3-1-lite",
    name: "Google Veo 3.1 Lite",
    category: "video",
    description: "A fast, lower-cost tier of Google's Veo 3.1 video model.",
    badge: null,
    isFeatured: false,
    sortOrder: 25,
    adapter: "wavespeed",
    providerModelPath: "google/veo3.1-lite/text-to-video",
    basePriceUsd: 1.2,
    creditCost: 24,
    fields: [ASPECT_RATIO, RESOLUTION_VID, DURATION(["4", "6", "8"], "8")],
  },
  {
    modelId: "happyhorse-1-0",
    name: "HappyHorse",
    category: "video",
    description: "Alibaba's HappyHorse 1.0 — a strong all-round text-to-video and image-to-video model.",
    badge: null,
    isFeatured: false,
    sortOrder: 26,
    adapter: "wavespeed",
    providerModelPath: "alibaba/happyhorse-1.0/text-to-video",
    basePriceUsd: 0.35,
    creditCost: 7,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "grok-imagine-video-1-5",
    name: "Grok Imagine 1.5",
    category: "video",
    description: "xAI's Grok Imagine video model — cinematic videos with synchronized audio.",
    badge: null,
    isFeatured: false,
    sortOrder: 27,
    adapter: "wavespeed",
    providerModelPath: "x-ai/grok-imagine-video/text-to-video",
    basePriceUsd: 0.4,
    creditCost: 8,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "wan-2-7",
    name: "Wan 2.7",
    category: "video",
    description: "Alibaba's Wan 2.7 — AI video generation with first- and end-frame control.",
    badge: null,
    isFeatured: false,
    sortOrder: 28,
    adapter: "wavespeed",
    providerModelPath: "alibaba/wan-2.7/text-to-video",
    basePriceUsd: 0.3,
    creditCost: 6,
    fields: [ASPECT_RATIO, DURATION(["5", "10"], "5")],
  },
  {
    modelId: "hailuo-2-3",
    name: "MiniMax Hailuo 2.3",
    category: "video",
    description: "MiniMax's fastest high-dynamic video model, physics-aware and efficient.",
    badge: null,
    isFeatured: false,
    sortOrder: 29,
    adapter: "wavespeed",
    providerModelPath: "minimax/hailuo-2.3/t2v-standard",
    basePriceUsd: 0.28,
    creditCost: 6,
    fields: [ASPECT_RATIO, DURATION(["6", "10"], "6")],
  },
  {
    modelId: "minimax-speech-2-8-hd",
    name: "MiniMax Speech 2.8 HD",
    category: "audio",
    description: "High-fidelity single-voice narration from MiniMax's Speech 2.8 HD model.",
    badge: null,
    isFeatured: false,
    sortOrder: 30,
    adapter: "wavespeed",
    providerModelPath: "minimax/speech-2.8-hd",
    basePriceUsd: 0.05,
    creditCost: 1,
    fields: [
      { key: "voice_id", label: "Voice", type: "select", options: ["Wise_Woman", "Friendly_Person", "Deep_Voice_Man", "Calm_Woman"], default: "Wise_Woman" },
      { key: "speed", label: "Speed", type: "number", min: 0.5, max: 2, step: 0.1, default: 1 },
    ],
  },
  {
    modelId: "vibevoice",
    name: "VibeVoice",
    category: "audio",
    description: "Microsoft's VibeVoice — long-form, multi-speaker narration built for audiobooks and podcasts.",
    badge: null,
    isFeatured: false,
    sortOrder: 31,
    adapter: "wavespeed",
    providerModelPath: "microsoft/vibevoice",
    basePriceUsd: 0.08,
    creditCost: 2,
    fields: [
      { key: "speaker", label: "Speaker voice", type: "select", options: ["Speaker 1", "Speaker 2", "Speaker 3", "Speaker 4"], default: "Speaker 1" },
    ],
  },
  {
    modelId: "seed-speech-tts-2-0",
    name: "Seed Speech",
    category: "audio",
    description: "ByteDance's Seed Speech TTS 2.0 — multilingual speech generation across 30+ languages.",
    badge: null,
    isFeatured: false,
    sortOrder: 32,
    adapter: "wavespeed",
    providerModelPath: "bytedance/seed-speech-tts-2.0",
    basePriceUsd: 0.04,
    creditCost: 1,
    fields: [
      { key: "language", label: "Language", type: "select", options: ["English", "Mandarin", "Spanish", "Japanese", "French", "German"], default: "English" },
    ],
  },

  // ── BYOK-only adapters ────────────────────────────────────────────────────
  // These models require the user to have saved their own API key for the
  // provider (via the "Add Your Keys" panel). The platform does not supply a
  // key for these adapters; creditCost is 0 since BYOK pricing is billed
  // directly by the provider on the user's own account.

  {
    modelId: "dall-e-3",
    name: "DALL·E 3",
    category: "image",
    description:
      "OpenAI's flagship image model — photorealistic detail with exceptional prompt adherence. Requires your own OpenAI key.",
    badge: null,
    isFeatured: false,
    sortOrder: 20,
    adapter: "openai",
    providerModelPath: "dall-e-3", // passed as `model` in OpenAI images/generations body
    basePriceUsd: 0.04, // ~$0.04/image at standard quality (1024×1024) — confirmed openai.com/api/pricing
    // ⚠️  BYOK-ONLY GUARD: creditCost reflects what the platform WOULD charge if a
    // platform key were ever added to getPlatformApiKey() in keyRouting.ts.
    // Do NOT set this to 0. If a platform key is added without updating creditCost,
    // all generations would be free — a silent revenue leak. The BYOK flag lives
    // only in keyRouting.ts (no isBYOKOnly column in the schema); this non-zero
    // value is the safeguard on the billing side.
    creditCost: 1, // BYOK — charged on user's own OpenAI account; 1 credit = $0.05 platform reserve
    fields: [
      {
        key: "size",
        label: "Size",
        type: "select",
        options: ["1024x1024", "1792x1024", "1024x1792"],
        default: "1024x1024",
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        options: ["standard", "hd"],
        default: "standard",
      },
      {
        key: "style",
        label: "Style",
        type: "select",
        options: ["vivid", "natural"],
        default: "vivid",
      },
    ] as ParamField[],
  },

  {
    modelId: "kling-v1-5-direct",
    name: "Kling v1.5 (Direct)",
    category: "video",
    description:
      "Kuaishou's Kling v1.5 via the official Kling API — smooth cinematic motion with a direct provider connection. Requires your own Kling key.",
    badge: null,
    isFeatured: false,
    sortOrder: 21,
    adapter: "kling",
    providerModelPath: "kling-v1-5", // passed as `model_name` in Kling text2video request
    basePriceUsd: 0.28, // ~$0.28 / 5 s standard — approximate; verify at klingai.com/pricing
    // ⚠️  BYOK-ONLY GUARD — see dall-e-3 comment above for rationale.
    creditCost: 6, // BYOK — charged on user's own Kling account; 6 credits = $0.30 platform reserve
    fields: [
      ASPECT_RATIO,
      DURATION(["5", "10"], "5"),
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: ["standard", "professional"],
        default: "standard",
        helpText: "Professional mode produces sharper detail at higher cost.",
      },
    ] as ParamField[],
  },

  {
    modelId: "elevenlabs-tts",
    name: "ElevenLabs TTS",
    category: "audio",
    description:
      "Studio-quality text-to-speech with expressive, character-driven voices. Requires your own ElevenLabs key.",
    badge: null,
    isFeatured: false,
    sortOrder: 22,
    adapter: "elevenlabs",
    // Format: "<model_id>/<default_voice_name>" — the adapter splits on "/" to
    // extract defaults; the paramsSchema voice_id select overrides the voice.
    providerModelPath: "eleven_multilingual_v2/Rachel",
    basePriceUsd: 0.09, // ~$0.09 / 30 s of speech (≈ 300 chars × $0.30/1 K chars)
    // ⚠️  BYOK-ONLY GUARD — see dall-e-3 comment above for rationale.
    creditCost: 2, // BYOK — charged on user's own ElevenLabs account; 2 credits = $0.10 platform reserve
    fields: [
      {
        key: "voice_id",
        label: "Voice",
        type: "select",
        // Fallback shown only before a valid ElevenLabs key is connected (or
        // if the live fetch fails) — dynamicOptions makes the frontend fetch
        // the caller's real, plan/account-specific voices from
        // GET /providers/elevenlabs/voices instead of relying on this list.
        // Human-readable names here map to legacy defaults in VOICE_ID_MAP.
        options: ["Rachel", "Domi", "Bella", "Antoni", "Elli", "Josh", "Adam", "Sam"],
        dynamicOptions: "voices",
        default: "Rachel",
      },
      {
        key: "stability",
        label: "Stability",
        type: "number",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        helpText: "Higher = more consistent delivery; lower = more expressive.",
      },
      {
        key: "similarity_boost",
        label: "Similarity",
        type: "number",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.75,
        helpText: "How closely the output matches the original voice character.",
      },
    ] as ParamField[],
  },

  {
    modelId: "eleven-v3",
    name: "Eleven v3",
    category: "audio",
    description:
      "ElevenLabs' most emotionally rich, expressive speech model — dramatic delivery with emotion/delivery control via inline tags (e.g. \"[whispers] like this\"). Requires your own ElevenLabs key.",
    badge: "NEW",
    isFeatured: false,
    sortOrder: 23,
    adapter: "elevenlabs",
    // Same "<model_id>/<default_voice_name>" convention as elevenlabs-tts above.
    providerModelPath: "eleven_v3/Rachel",
    basePriceUsd: 0.09,
    // ⚠️  BYOK-ONLY GUARD — see dall-e-3 comment above for rationale.
    creditCost: 2, // BYOK — charged on user's own ElevenLabs account; 2 credits = $0.10 platform reserve
    fields: [
      {
        key: "voice_id",
        label: "Voice",
        type: "select",
        options: ["Rachel", "Domi", "Bella", "Antoni", "Elli", "Josh", "Adam", "Sam"],
        dynamicOptions: "voices",
        default: "Rachel",
      },
      {
        key: "stability",
        label: "Stability",
        type: "number",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        helpText: "Higher = more consistent delivery; lower = more expressive.",
      },
      {
        key: "similarity_boost",
        label: "Similarity",
        type: "number",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.75,
        helpText: "How closely the output matches the original voice character.",
      },
    ] as ParamField[],
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
      slug: "fal",
      name: "fal.ai",
      icon: "https://logo.clearbit.com/fal.ai",
      capabilities: ["image", "video"],
      supportsByok: true,
      keyFormatHint: "fal-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      description: "Fast image & video generation",
      docsUrl: "https://fal.ai/dashboard/keys",
      status: "active",
    },
    {
      slug: "openai",
      name: "OpenAI",
      icon: "https://logo.clearbit.com/openai.com",
      capabilities: ["image", "text"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-",
      description: "GPT-4o, DALL-E 3, Whisper",
      docsUrl: "https://platform.openai.com/api-keys",
      status: "active",
    },
    {
      slug: "openrouter",
      name: "OpenRouter",
      icon: "https://logo.clearbit.com/openrouter.ai",
      capabilities: ["text"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-or-",
      description: "LLM gateway with 100+ models",
      docsUrl: "https://openrouter.ai/keys",
      status: "active",
    },
    {
      slug: "elevenlabs",
      name: "ElevenLabs",
      icon: "https://logo.clearbit.com/elevenlabs.io",
      capabilities: ["audio"],
      supportsByok: true,
      keyFormatHint: "Find this in your ElevenLabs account settings.",
      description: "AI voice & speech synthesis",
      docsUrl: "https://elevenlabs.io/app/settings/api-keys",
      status: "active",
    },
    {
      slug: "anthropic",
      name: "Anthropic",
      icon: "https://logo.clearbit.com/anthropic.com",
      capabilities: ["text"],
      supportsByok: true,
      keyFormatHint: "Starts with sk-ant-",
      description: "Claude 3.5, Claude 3, Claude 3 Haiku",
      docsUrl: "https://console.anthropic.com/settings/keys",
      status: "active",
    },
    {
      slug: "kling",
      name: "Kling AI",
      icon: "https://logo.clearbit.com/klingai.com",
      capabilities: ["video"],
      supportsByok: true,
      keyFormatHint: "Find this in your Kling AI account settings.",
      description: "AI video generation",
      docsUrl: "https://klingai.com/developer",
      status: "active",
    },
    {
      slug: "google",
      name: "Google (Veo)",
      icon: "https://logo.clearbit.com/google.com",
      capabilities: ["video", "image", "text"],
      supportsByok: true,
      keyFormatHint: "Google AI Studio / Vertex AI API key.",
      description: "Veo 2, Gemini models",
      docsUrl: "https://aistudio.google.com/apikey",
      status: "active",
    },
    {
      slug: "wavespeed",
      name: "WaveSpeed",
      icon: "https://logo.clearbit.com/wavespeed.ai",
      capabilities: ["image", "video"],
      supportsByok: true,
      keyFormatHint: "Find this in your WaveSpeed AI account settings.",
      description: "Image & video generation",
      docsUrl: "https://app.wavespeed.ai/account",
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

  // Site settings — insert-if-missing only (never upsert), so an admin's
  // edited value is never reverted by re-running this script. Driven
  // entirely by the Configuration Registry; add a setting there, not here.
  console.log("Seeding site settings...");
  for (const def of SETTINGS_REGISTRY) {
    await db
      .insert(siteSettingsTable)
      .values({
        key: def.key,
        value: JSON.stringify(def.default),
        type: def.type,
        category: def.category,
        isPublic: def.isPublic,
        description: def.description,
      })
      // `value` is intentionally excluded from the conflict update — an
      // admin's edit must never be reverted by re-running this script.
      // Everything else is just the registry's own metadata mirrored for
      // convenience, so it's safe (and correct) to always resync it.
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { type: def.type, category: def.category, isPublic: def.isPublic, description: def.description },
      });
  }
  await db.insert(settingsMetaTable).values({ id: 1, version: 1 }).onConflictDoNothing({ target: settingsMetaTable.id });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
