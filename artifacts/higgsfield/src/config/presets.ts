// Viral Presets library — a curated, one-click layer on top of the existing
// model catalog. This is presentation-only: every preset maps to a real
// model already in the catalog and just prefills a tuned prompt for it via
// the same `regeneratePrefill` sessionStorage handoff the Library's
// "Regenerate" action already uses (see tool-detail.tsx). No new backend
// logic, no new database table.
export type Preset = {
  id: string;
  name: string;
  description: string;
  category: "image" | "video" | "audio";
  modelId: string;
  prompt: string;
  // Real thumbnail URL when one exists from the model catalog (see
  // lib/db/seed-thumbnails.ts); otherwise undefined and the card renders a
  // designed color-block placeholder instead of a broken image or gradient.
  accent: string;
};

export const PRESETS: Preset[] = [
  {
    id: "golden-hour-glow",
    name: "Golden Hour Glow",
    description: "Warm, soft-focus relight for portraits — like shooting at sunset.",
    category: "image",
    modelId: "nano-banana-pro-edit",
    prompt: "Relight this portrait with warm golden-hour sunlight, soft rim light, gentle lens flare, cozy warm color grade.",
    accent: "#F5A623",
  },
  {
    id: "studio-sweep",
    name: "Studio Sweep",
    description: "Clean seamless-backdrop product shot with crisp studio lighting.",
    category: "image",
    modelId: "nano-banana-pro-ultra",
    prompt: "A product photographed on a seamless white studio backdrop, soft box lighting, subtle shadow, catalog-ready composition.",
    accent: "#CEFF00",
  },
  {
    id: "banana-split",
    name: "Fast Concept",
    description: "Quick, affordable concept art for early idea exploration.",
    category: "image",
    modelId: "nano-banana-2",
    prompt: "A vivid concept illustration exploring a bold creative idea, strong composition, confident color palette.",
    accent: "#7C6BFF",
  },
  {
    id: "fresh-frame",
    name: "Fresh Frame",
    description: "High-fidelity hero image with rich detail and depth.",
    category: "image",
    modelId: "seedream-v5-pro",
    prompt: "A striking hero image with rich texture, cinematic depth of field, and high dynamic range lighting.",
    accent: "#4FD1C5",
  },
  {
    id: "lite-sketch",
    name: "Lite Sketch",
    description: "Cheap, fast rough drafts for iterating on an idea before committing credits.",
    category: "image",
    modelId: "seedream-v5-lite",
    prompt: "A quick rough visual sketch capturing the core idea and composition, minimal detail, fast iteration draft.",
    accent: "#94A3B8",
  },
  {
    id: "dreamscape-drift",
    name: "Dreamscape Drift",
    description: "Turn a still photo into a slow, dreamlike drifting motion clip.",
    category: "video",
    modelId: "wan-2-2-image-to-video",
    prompt: "Animate this still image with a slow, dreamlike drifting camera motion, soft ambient movement, gentle parallax.",
    accent: "#F472B6",
  },
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    description: "High-energy cinematic clip with bold color and dramatic motion.",
    category: "video",
    modelId: "seedance-2-0",
    prompt: "A high-energy cinematic clip with bold neon lighting, dramatic camera movement, punchy color grade.",
    accent: "#22D3EE",
  },
  {
    id: "quick-draft",
    name: "Quick Draft",
    description: "Fast, low-cost video preview to test a concept before the full render.",
    category: "video",
    modelId: "seedance-2-0-fast",
    prompt: "A quick draft-quality video preview of the scene, simple camera movement, fast turnaround.",
    accent: "#A3E635",
  },
  {
    id: "boardroom-ready",
    name: "Boardroom Ready",
    description: "Polished, professional motion for pitch decks and product demos.",
    category: "video",
    modelId: "kling-v3-pro",
    prompt: "A polished, professional product demo clip, clean studio lighting, smooth stabilized camera motion, presentation-ready.",
    accent: "#60A5FA",
  },
  {
    id: "everyday-clip",
    name: "Everyday Clip",
    description: "Budget-friendly, reliable motion for everyday social content.",
    category: "video",
    modelId: "kling-v3-std",
    prompt: "A simple, everyday social clip with natural motion and casual framing.",
    accent: "#FBBF24",
  },
  {
    id: "sync-beat",
    name: "Sync Beat",
    description: "Short clip with synced audio — motion and sound generated together.",
    category: "video",
    modelId: "veo-3-1",
    prompt: "A short clip with synchronized ambient sound and motion, natural pacing, tight framing.",
    accent: "#F87171",
  },
  {
    id: "long-take",
    name: "Long Take",
    description: "Extended single-shot explainer with continuous camera motion.",
    category: "video",
    modelId: "sora-2",
    prompt: "An extended single continuous take exploring the scene, smooth camera motion, natural pacing, explainer-style clarity.",
    accent: "#818CF8",
  },
  {
    id: "voice-note",
    name: "Voice Note",
    description: "Natural spoken narration or voiceover from text.",
    category: "audio",
    modelId: "seed-audio-1-0",
    prompt: "A warm, natural spoken voiceover narration reading the given text clearly and expressively.",
    accent: "#34D399",
  },
];
