import { buildIsoReviewPrompts, type AiReviewPromptItem } from "@/lib/ai-review-prompt";

const DEFAULT_GEMINI_REVIEW_MODEL = "gemini-2.0-flash";

// Схемата на Gemini е OpenAPI подмножество - без additionalProperties.
const GEMINI_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          suggested: { type: "string" },
          reason: { type: "string" },
          category: { type: "string", enum: ["language", "context", "consistency", "risk"] },
          confidence: { type: "number" }
        },
        required: ["id", "suggested", "reason", "category", "confidence"]
      }
    }
  },
  required: ["suggestions"]
} as const;

type GeminiResponse = {
  error?: { message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function geminiApiKey() {
  return (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();
}

export function hasGeminiConfiguration() {
  return Boolean(geminiApiKey());
}

export function geminiReviewModel() {
  return process.env.GEMINI_REVIEW_MODEL?.trim() || DEFAULT_GEMINI_REVIEW_MODEL;
}

export async function generateGeminiTextReview(context: string, items: AiReviewPromptItem[]) {
  const apiKey = geminiApiKey();
  const model = geminiReviewModel();
  if (!apiKey) throw new Error("Липсва GEMINI_API_KEY във Vercel.");
  if (!items.length) return { response: '{"suggestions":[]}', model: `Gemini · ${model}` };

  const prompts = buildIsoReviewPrompts(context, items);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompts.system }] },
        contents: [{ role: "user", parts: [{ text: prompts.input }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8_192,
          responseMimeType: "application/json",
          responseSchema: GEMINI_REVIEW_SCHEMA
        }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000)
    }
  );

  const payload = await response.json().catch(() => null) as GeminiResponse | null;
  if (!response.ok || payload?.error) throw new Error(geminiError(response.status, payload?.error));
  if (payload?.promptFeedback?.blockReason) throw new Error(`Gemini блокира заявката: ${payload.promptFeedback.blockReason}`);
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini върна празен текстов преглед.");
  return { response: text, model: `Gemini · ${model}` };
}

function geminiError(status: number, error?: GeminiResponse["error"]) {
  const detail = error?.message?.trim();
  if (status === 400 && detail?.includes("API key")) return "Gemini API ключът е невалиден.";
  if (status === 401 || status === 403) return "Gemini API ключът е невалиден или няма достъп до модела.";
  if (status === 404) return "Избраният Gemini модел не е намерен.";
  if (status === 429) return detail || "Достигнат е безплатният лимит на Gemini API. Опитайте отново по-късно.";
  if (status >= 500) return "Gemini временно не е достъпен.";
  return detail ? `Gemini: ${detail}` : `Gemini върна HTTP грешка ${status}.`;
}
