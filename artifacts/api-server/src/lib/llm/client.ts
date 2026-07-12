import OpenAI from "openai";

// Direct OpenRouter client (OpenAI-SDK compatible), using the user's own
// OPENROUTER_API_KEY. Intentionally NOT the Replit AI Integrations proxy —
// the user asked to use their own OpenRouter key.
let client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY must be set to use the prompt planning layer.");
  }
  client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  return client;
}

// Fast/cheap tier: prompt enhancement, param defaults — anything deterministic.
export const FAST_MODEL = "google/gemini-3.1-flash-lite";
// Reasoning tier: ambiguous intent interpretation (auto model selection).
export const REASONING_MODEL = "anthropic/claude-sonnet-5";
