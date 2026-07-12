import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getOpenRouterClient, FAST_MODEL } from "../lib/llm/client";
import {
  getModeSystemPrompt,
  buildFallbackPrompt,
  MODE_MODEL_IDS,
  type CreativeMode,
  type UgcSubVariant,
  type BuildPromptInput,
} from "../config/creative-mode-prompts";

const router: IRouter = Router();

// ─── POST /marketing/url-analyze ─────────────────────────────────────────────
/**
 * Fetch a product page URL and use OpenRouter to extract product name +
 * description for the Marketing Studio URL-to-Ad flow.
 */
router.post("/marketing/url-analyze", requireAuth, async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL format" });
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: "Only HTTP/HTTPS URLs are supported" });
    return;
  }

  // Fetch the page HTML
  let htmlText = "";
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketingStudio/1.0; +https://higgsfield.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Could not fetch URL (HTTP ${response.status})` });
      return;
    }
    htmlText = await response.text();
  } catch (err) {
    req.log.error({ err, url }, "Failed to fetch URL for analysis");
    res.status(502).json({
      error: "Could not fetch that URL — check it is publicly accessible.",
    });
    return;
  }

  // Strip scripts/styles/tags, collapse whitespace, limit to 4 000 chars
  const pageText = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  // Require OpenRouter for the AI step
  let client;
  try {
    client = getOpenRouterClient();
  } catch {
    res.status(503).json({
      error: "AI analysis is not configured — OPENROUTER_API_KEY is missing.",
    });
    return;
  }

  try {
    const completion = await client.chat.completions.create({
      model: FAST_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a marketing analyst. Extract product information from webpage text.
Return ONLY valid JSON with exactly these fields:
- productName: short product or brand name (2–5 words)
- tagline: one concise value-proposition sentence
- description: 1–2 sentences describing what the product does and its key benefit, written as an ad brief`,
        },
        {
          role: "user",
          content: `Extract product info from this page text:\n\n${pageText}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 350,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    res.json({
      productName: (parsed.productName ?? "").trim(),
      tagline: (parsed.tagline ?? "").trim(),
      description: (parsed.description ?? "").trim(),
    });
  } catch (err) {
    req.log.error({ err }, "OpenRouter URL analysis failed");
    res.status(500).json({
      error: "AI analysis failed — describe your product manually.",
    });
  }
});

// ─── POST /marketing/build-prompt ────────────────────────────────────────────
/**
 * Build a structured video generation prompt for a given creative mode.
 *
 * If OPENROUTER_API_KEY is available, the mode-specific system prompt is
 * sent to the LLM planning layer to produce a rich, cinematographer-quality
 * prompt. Otherwise a deterministic fallback is returned — the endpoint never
 * returns an error for this reason, so the UI can always proceed.
 *
 * Returns: { prompt: string, modelId: string }
 */
router.post("/marketing/build-prompt", requireAuth, async (req, res): Promise<void> => {
  const {
    productName = "",
    description = "",
    mode,
    ugcSubVariant,
    sourceType = "product",
    hasAvatar = false,
    hasProductImage = false,
  } = req.body as {
    productName?: string;
    description?: string;
    mode?: string;
    ugcSubVariant?: string;
    sourceType?: string;
    hasAvatar?: boolean;
    hasProductImage?: boolean;
  };

  const validModes: string[] = ["ugc", "cgi", "cinematic", "wildcard"];
  if (!mode || !validModes.includes(mode)) {
    res.status(400).json({ error: "mode must be one of: ugc, cgi, cinematic, wildcard" });
    return;
  }

  const input: BuildPromptInput = {
    productName: String(productName).trim(),
    description: String(description).trim(),
    mode: mode as CreativeMode,
    ugcSubVariant: ugcSubVariant as UgcSubVariant | undefined,
    sourceType: sourceType === "app" ? "app" : "product",
    hasAvatar: Boolean(hasAvatar),
    hasProductImage: Boolean(hasProductImage),
  };

  const modelId = MODE_MODEL_IDS[mode as CreativeMode];

  // Graceful fallback when OpenRouter is not configured
  let client;
  try {
    client = getOpenRouterClient();
  } catch {
    res.json({ prompt: buildFallbackPrompt(input), modelId });
    return;
  }

  // Build the user message from the structured input
  const userLines: string[] = [
    `Product: ${input.productName || "this product"}`,
    input.description ? `Brief: ${input.description}` : "",
    input.hasAvatar ? "A human spokesperson / avatar will appear on camera." : "",
    mode === "ugc" && ugcSubVariant ? `UGC sub-format: ${ugcSubVariant}` : "",
    input.hasProductImage ? "A product reference image is available as the animation source." : "",
  ].filter(Boolean);

  try {
    const completion = await client.chat.completions.create({
      model: FAST_MODEL,
      messages: [
        { role: "system", content: getModeSystemPrompt(mode as CreativeMode) },
        { role: "user", content: userLines.join("\n") },
      ],
      max_tokens: 300,
    });

    const builtPrompt = (completion.choices[0]?.message?.content ?? "").trim();
    res.json({
      prompt: builtPrompt || buildFallbackPrompt(input),
      modelId,
    });
  } catch (err) {
    req.log.error({ err }, "OpenRouter build-prompt failed");
    // Always return something usable — never let a planning-layer failure block generation
    res.json({ prompt: buildFallbackPrompt(input), modelId });
  }
});

export default router;
