import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getOpenRouterClient, FAST_MODEL } from "../lib/llm/client";

const router: IRouter = Router();

/**
 * POST /marketing/url-analyze
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

export default router;
