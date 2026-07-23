import {
  buildIsoReviewPrompts,
  ISO_REVIEW_JSON_SCHEMA,
  type AiReviewPromptItem
} from "@/lib/ai-review-prompt";

const DEFAULT_GEMINI_REVIEW_MODEL = "gemini-2.0-flash";

type GeminiResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export function geminiReviewModel() {
  return process.env.GEMINI_REVIEW_MODEL?.trim() || DEFAULT_GEMINI_REVIEW_MODEL;
}

export async function generateGeminiTextReview(context: string, items: AiReviewPromptItem[]) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = geminiReviewModel();
  if (!apiKey) throw new Error("Липсва GEMINI_API_KEY във Vercel.");
  if (!items.length) return { response: '{"suggestions":[]}', model: `Gemini · ${model}` };

  const prompts = buildIsoReviewPrompts(context, items);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: prompts.system }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompts.input }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 6_000,
          responseMimeType: "application/json",
          responseSchema: geminiReviewSchema()
        }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000)
    }
  );
  const payload = await response.json().catch(() => null) as GeminiResponse | null;
  if (!response.ok || payload?.error) {
    throw new Error(geminiError(response.status, payload?.error));
  }
  if (payload?.promptFeedback?.blockReason) {
    throw new Error(
      payload.promptFeedback.blockReasonMessage?.trim()
        || `Gemini блокира заявката: ${payload.promptFeedback.blockReason}.`
    );
  }
  const text = extractGeminiOutputText(payload);
  if (!text) {
    const finishReason = payload?.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Gemini не върна текстов преглед. Причина: ${finishReason}.`
        : "Gemini върна празен текстов преглед."
    );
  }
  return { response: text, model: `Gemini · ${model}` };
}

export function extractGeminiOutputText(payload: GeminiResponse | null) {
  return (payload?.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("");
}

export function geminiReviewSchema() {
  const suggestionProperties = ISO_REVIEW_JSON_SCHEMA.properties.suggestions.items.properties;
  return {
    ...ISO_REVIEW_JSON_SCHEMA,
    propertyOrdering: ["suggestions"],
    properties: {
      suggestions: {
        ...ISO_REVIEW_JSON_SCHEMA.properties.suggestions,
        items: {
          ...ISO_REVIEW_JSON_SCHEMA.properties.suggestions.items,
          propertyOrdering: ["id", "suggested", "reason", "category", "confidence"],
          properties: suggestionProperties
        }
      }
    }
  };
}

function geminiError(status: number, error?: GeminiResponse["error"]) {
  const detail = error?.message?.trim();
  if (status === 400) return detail ? `Gemini: ${detail}` : "Gemini отхвърли заявката като невалидна.";
  if (status === 401) return "Gemini API ключът е невалиден или е изтекъл.";
  if (status === 403) return detail || "Gemini API ключът няма достъп до избрания модел.";
  if (status === 404) return "Избраният Gemini модел не е намерен или не е достъпен за API ключа.";
  if (status === 429) return detail || "Достигнат е лимитът на Gemini API. Опитайте отново след малко.";
  if (status >= 500) return "Gemini временно не е достъпен.";
  return detail ? `Gemini: ${detail}` : `Gemini върна HTTP грешка ${status}.`;
}
