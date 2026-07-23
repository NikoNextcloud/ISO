import {
  buildIsoReviewPrompts,
  type AiReviewPromptItem
} from "@/lib/ai-review-prompt";

const DEFAULT_GEMINI_REVIEW_MODEL = "gemini-3.5-flash";
const FALLBACK_GEMINI_REVIEW_MODEL = "gemini-3.1-flash-lite";
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001"
]);

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
  const configured = process.env.GEMINI_REVIEW_MODEL?.trim().replace(/^models\//, "");
  if (!configured || RETIRED_GEMINI_MODELS.has(configured)) return DEFAULT_GEMINI_REVIEW_MODEL;
  return configured;
}

export async function generateGeminiTextReview(context: string, items: AiReviewPromptItem[]) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = geminiReviewModel();
  if (!apiKey) throw new Error("Липсва GEMINI_API_KEY във Vercel.");
  if (!items.length) return { response: '{"suggestions":[]}', model: `Gemini · ${model}` };

  const prompts = buildIsoReviewPrompts(context, items);
  let selectedModel = model;
  let result = await requestGeminiReview(apiKey, selectedModel, prompts);
  if (
    selectedModel !== FALLBACK_GEMINI_REVIEW_MODEL
    && shouldTryGeminiFallback(result.response.status, result.payload)
  ) {
    selectedModel = FALLBACK_GEMINI_REVIEW_MODEL;
    result = await requestGeminiReview(apiKey, selectedModel, prompts);
  }

  const { response, payload } = result;
  if (!response.ok || payload?.error) {
    throw new Error(geminiError(response.status, payload?.error, selectedModel));
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
  return { response: text, model: `Gemini · ${selectedModel}` };
}

async function requestGeminiReview(
  apiKey: string,
  model: string,
  prompts: ReturnType<typeof buildIsoReviewPrompts>
) {
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
  return { response, payload };
}

export function extractGeminiOutputText(payload: GeminiResponse | null) {
  return (payload?.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("");
}

export function geminiReviewSchema() {
  return {
    type: "object",
    propertyOrdering: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          propertyOrdering: ["id", "suggested", "reason", "category", "confidence"],
          properties: {
            id: { type: "string" },
            suggested: { type: "string" },
            reason: { type: "string" },
            category: {
              type: "string",
              enum: ["language", "context", "consistency", "risk"]
            },
            confidence: { type: "number" }
          },
          required: ["id", "suggested", "reason", "category", "confidence"]
        }
      }
    },
    required: ["suggestions"]
  };
}

function shouldTryGeminiFallback(status: number, payload: GeminiResponse | null) {
  if (status === 404) return true;
  const detail = payload?.error?.message ?? "";
  return status === 429 && /\blimit:\s*0\b|quota[^.]*\b0\b/i.test(detail);
}

function geminiError(status: number, error: GeminiResponse["error"] | undefined, model: string) {
  const detail = error?.message?.trim();
  if (status === 400) return detail ? `Gemini: ${detail}` : "Gemini отхвърли заявката като невалидна.";
  if (status === 401) return "Gemini API ключът е невалиден или е изтекъл.";
  if (status === 403) return detail || "Gemini API ключът няма достъп до избрания модел.";
  if (status === 404) return "Избраният Gemini модел не е намерен или не е достъпен за API ключа.";
  if (status === 429 && detail && /\blimit:\s*0\b|quota[^.]*\b0\b/i.test(detail)) {
    return `Gemini API проектът няма активна квота за ${model}. Проверете квотата в Google AI Studio или активирайте billing.`;
  }
  if (status === 429) return "Достигнат е временният лимит на Gemini API. Изчакайте една минута и опитайте отново.";
  if (status >= 500) return "Gemini временно не е достъпен.";
  return detail ? `Gemini: ${detail}` : `Gemini върна HTTP грешка ${status}.`;
}
