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

// ─── Structured HTML extraction helpers ───────────────────────────────────────

/** Read a <meta property|name="key" content="..."> tag (tries both attribute orderings). */
function extractMeta(html: string, ...keys: string[]): string {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"'<>]+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
  }
  return "";
}

/** Read the text of the first <title> element. */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

/**
 * Scan all application/ld+json blocks and return the first node whose @type
 * matches a known product/brand type.
 */
function extractJsonLd(html: string): Record<string, unknown> {
  const blocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  const preferredTypes = [
    "Product",
    "SoftwareApplication",
    "MobileApplication",
    "Organization",
    "LocalBusiness",
    "WebSite",
  ];
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]) as Record<string, unknown>;
      const items: Record<string, unknown>[] = Array.isArray(data?.["@graph"])
        ? (data["@graph"] as Record<string, unknown>[])
        : [data];
      for (const item of items) {
        if (preferredTypes.includes(item?.["@type"] as string)) return item;
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return {};
}

// ─── POST /marketing/url-analyze ─────────────────────────────────────────────
/**
 * Fetch a product page URL and use structured HTML signals + OpenRouter to
 * extract productName, tagline, description, and imageUrl for the Marketing
 * Studio URL-to-Ad flow.
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

  // ── Extract structured signals ─────────────────────────────────────────────
  const ogTitle       = extractMeta(htmlText, "og:title", "twitter:title");
  const ogDescription = extractMeta(htmlText, "og:description", "twitter:description", "description");
  const ogImage       = extractMeta(htmlText, "og:image", "twitter:image");
  const ogSiteName    = extractMeta(htmlText, "og:site_name");
  const pageTitle     = extractTitle(htmlText);
  const jsonLd        = extractJsonLd(htmlText);
  const ldName        = String(jsonLd["name"] ?? "").trim();
  const ldDescription = String(jsonLd["description"] ?? "").trim();

  // Resolve the product image URL; make relative URLs absolute
  let imageUrl = ogImage;
  if (imageUrl && !imageUrl.startsWith("http")) {
    try {
      imageUrl = new URL(imageUrl, parsedUrl.origin).toString();
    } catch {
      imageUrl = "";
    }
  }

  // Build a structured hint block for the LLM — richer input → better output
  const structuredHints = [
    (ogTitle || pageTitle) ? `Page title: ${ogTitle || pageTitle}` : null,
    ogSiteName            ? `Site name: ${ogSiteName}`            : null,
    ldName                ? `Schema.org name: ${ldName}`          : null,
    ogDescription         ? `Meta description: ${ogDescription}`  : null,
    ldDescription         ? `Schema.org description: ${ldDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Strip scripts/styles/tags, collapse whitespace, limit body to 3 000 chars
  const bodyText = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  const pageText = [
    structuredHints,
    bodyText ? `\nPage body (truncated):\n${bodyText}` : "",
  ]
    .join("\n")
    .trim();

  // ── LLM analysis ──────────────────────────────────────────────────────────
  let client;
  try {
    client = getOpenRouterClient();
  } catch {
    // No LLM key — return whatever structured signals we have, or 503
    const fallbackName = ldName || ogTitle || pageTitle || ogSiteName || "";
    const fallbackDesc = ldDescription || ogDescription || "";
    if (fallbackName || fallbackDesc) {
      res.json({
        productName: fallbackName,
        tagline: "",
        description: fallbackDesc,
        ...(imageUrl ? { imageUrl } : {}),
      });
      return;
    }
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
          content: `You are a marketing analyst. Extract product information from webpage signals.
Return ONLY valid JSON with exactly these fields:
- productName: short product or brand name (2–5 words, prefer the actual product/brand name over a generic description)
- tagline: one concise value-proposition sentence (max 12 words)
- description: 1–2 sentences describing what the product does and its key benefit, written as a punchy ad brief for a short-form video`,
        },
        {
          role: "user",
          content: `Extract product info from these page signals:\n\n${pageText}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 350,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(raw) as Record<string, string>;
    } catch {
      parsed = {};
    }

    res.json({
      productName: (parsed.productName ?? "").trim(),
      tagline:     (parsed.tagline     ?? "").trim(),
      description: (parsed.description ?? "").trim(),
      ...(imageUrl ? { imageUrl } : {}),
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
