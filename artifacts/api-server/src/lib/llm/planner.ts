import { getOpenRouterClient, FAST_MODEL, REASONING_MODEL } from "./client";
import type { Model } from "@workspace/db";

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

// Fast tier — expands a short/plain prompt into a richer, model-appropriate
// prompt. Runs on every generation unless the caller opts out. Falls back to
// the original prompt on any error so a flaky LLM call never blocks generation.
export async function enhancePrompt(prompt: string, category: string): Promise<string> {
  try {
    const client = getOpenRouterClient();
    const completion = await client.chat.completions.create({
      model: FAST_MODEL,
      messages: [
        {
          role: "system",
          content: `You improve prompts for AI ${category} generation. Rewrite the user's prompt to be more vivid and specific (composition, lighting, style, motion where relevant) while preserving their original intent. Reply with ONLY the rewritten prompt, no preamble, no quotes.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    const enhanced = completion.choices[0]?.message?.content?.trim();
    return enhanced && enhanced.length > 0 ? enhanced : prompt;
  } catch {
    return prompt;
  }
}

// Reasoning tier — used only for "Auto" mode, when the user hasn't picked a
// specific model. Interprets intent against the live model catalog and
// returns the best-fit modelId.
export async function autoSelectModel(prompt: string, models: Model[]): Promise<{ modelId: string; reasoning: string }> {
  const client = getOpenRouterClient();
  const catalog = models.map((m) => `- ${m.modelId} (${m.category}): ${m.description}`).join("\n");

  const completion = await client.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      {
        role: "system",
        content: `You select the best AI generation model for a user's request from this catalog:\n${catalog}\n\nReply with ONLY compact JSON: {"modelId": "<one of the ids above>", "reasoning": "<one short sentence>"}`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 200,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(text);
  if (!parsed?.modelId || !models.some((m) => m.modelId === parsed.modelId)) {
    throw new Error("Model auto-selection returned an invalid modelId.");
  }
  return { modelId: parsed.modelId, reasoning: parsed.reasoning ?? "" };
}
