/**
 * Creative mode definitions for Marketing Studio.
 *
 * Each mode maps to a distinct LLM system prompt that restructures the
 * entire generation approach — not just a style word appended to a shared
 * template. Stored server-side so the planning layer can be updated without
 * a frontend deploy.
 */

export type CreativeMode = "ugc" | "cgi" | "cinematic" | "wildcard";
export type UgcSubVariant = "testimonial" | "unboxing" | "tutorial" | "handson";

export interface BuildPromptInput {
  productName: string;
  description: string;
  mode: CreativeMode;
  ugcSubVariant?: UgcSubVariant;
  sourceType?: "product" | "app";
  hasAvatar?: boolean;
  hasProductImage?: boolean;
}

/** Model IDs by mode — must match the DB seed values. */
export const MODE_MODEL_IDS: Record<CreativeMode, string> = {
  ugc: "wan-2-2-image-to-video",
  cgi: "kling-v3-pro",
  cinematic: "seedance-2-0",
  wildcard: "seedance-2-0",
};

/** Additional context injected into the user message for each UGC sub-variant. */
const UGC_SUB_CONTEXT: Record<UgcSubVariant, string> = {
  testimonial:
    "UGC format: direct-to-camera personal testimonial. Creator speaks authentically about their experience with the product, making eye contact with the lens.",
  unboxing:
    "UGC format: first-impression unboxing. Creator opens the packaging on camera for the first time, reacts to the reveal, and handles the product with genuine first-look energy.",
  tutorial:
    "UGC format: step-by-step tutorial / how-to. Creator demonstrates how to use the product in real life, talking naturally to camera while performing each action.",
  handson:
    "UGC format: hands-on demo. Close-up footage of hands using the product in a real environment, with natural narration drawing attention to key details, textures, and results.",
};

/**
 * Returns the LLM system prompt for the requested creative mode.
 * Each prompt enforces a distinct camera language, pacing, and structural approach.
 */
export function getModeSystemPrompt(mode: CreativeMode): string {
  switch (mode) {
    case "ugc":
      return `You are a UGC video ad scriptwriter who writes generation prompts for an AI video model.
Write a single paragraph (2–4 sentences) describing a face-to-camera, iPhone-shot creator ad.
Your prompt MUST specify:
- Creator framing (selfie-style, handheld, selfie stick, etc.)
- A specific real-world environment that fits the product (bedroom, kitchen, outdoors — choose one)
- What the creator physically does and the emotional beat they hit (excitement, surprise, genuine recommendation)
- Camera character: handheld shake, natural ambient light, no studio polish

Rules: Do NOT include text overlays, lower-thirds, titles, or slates. Do NOT explain your reasoning. Return ONLY the video prompt text.`;

    case "cgi":
      return `You are a CGI commercial director who writes generation prompts for an AI video model.
Write a single paragraph (2–4 sentences) describing a studio-grade, precision-crafted product ad.
Your prompt MUST specify:
- A specific environment (pure white void, abstract geometric space, luxury minimalist set — choose one)
- Exact camera movement with easing described in detail (slow orbit, push-in on hero surface, top-down pull-back, arc around product — be precise)
- Lighting setup with exact terminology (volumetric god-rays, edge-lit silhouette, softbox fill, neon accent rim, etc.)
- The product hero moment: what the product does or reveals

Style target: Apple product launch or luxury brand campaign. More specific camera + lighting language produces better output.
Rules: Do NOT include text overlays. Do NOT explain. Return ONLY the video prompt text.`;

    case "cinematic":
      return `You are a cinematic commercial director who writes generation prompts for an AI video model.
Write a single paragraph (2–4 sentences) describing a broadcast-ready ad with a clear story arc.
Your prompt MUST include:
- A specific real-world location with time of day and atmosphere
- A protagonist with just enough context to feel real (no name needed — describe them)
- The problem-solution beat where the product appears and changes something
- The visual payoff: how the scene resolves

Also specify: lens character (anamorphic flare, telephoto compression, wide-angle intimacy), lighting era (golden hour, flat overcast, neon night city), and camera movement (handheld tension, crane reveal, dolly push, locked tripod).
Rules: Do NOT include text overlays. Do NOT explain. Return ONLY the video prompt text.`;

    case "wildcard":
      return `You are an experimental creative director who rejects conventional ad formats entirely.
Write a single paragraph (2–4 sentences) for an AI video model — an unexpected, visually arresting approach to featuring the product.
Invent a creative concept. It can be surrealist, metaphorical, genre-bending, absurdist, or poetic — but it must feel intentional, not random.
The product must appear and be the reason the visual exists.

Specify: camera style, environment or world, and the unexpected central visual concept.
Rules: Do NOT include text overlays. Do NOT explain. Return ONLY the video prompt text.`;
  }
}

/**
 * Builds a deterministic fallback prompt when OpenRouter is unavailable.
 * Good enough for testing; the LLM version is meaningfully richer.
 */
export function buildFallbackPrompt(input: BuildPromptInput): string {
  const subject = input.sourceType === "app" ? "app" : "product";
  const name = input.productName.trim() || `this ${subject}`;
  const desc = input.description.trim();
  const avatarLine = input.hasAvatar ? " A creator spokesperson is featured." : "";

  switch (input.mode) {
    case "ugc": {
      const subCtx = UGC_SUB_CONTEXT[input.ugcSubVariant ?? "testimonial"];
      return `A short UGC creator ad for ${name}. ${desc} ${subCtx}${avatarLine} Shot on iPhone, handheld, natural ambient lighting, authentic creator energy.`.trim();
    }
    case "cgi":
      return `A studio-grade CGI commercial for ${name}. ${desc} Product hero shot on a clean white void with volumetric lighting. Slow orbit camera movement, smooth easing, edge-lit product surface. Polished Apple-launch quality.`.trim();
    case "cinematic":
      return `A cinematic broadcast commercial for ${name}. ${desc} Real-world location, golden hour light. A protagonist encounters a problem; the product solves it. Anamorphic lens, shallow depth of field, dramatic color grade, dolly push on the product reveal.`.trim();
    case "wildcard":
      return `An unexpected, visually arresting ad for ${name}. ${desc} Unconventional creative concept — surrealist or metaphorical. The product appears in a striking, memorable context that makes viewers stop scrolling.`.trim();
  }
}
