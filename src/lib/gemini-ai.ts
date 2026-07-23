import {
  buildIsoReviewPrompts,
  type AiReviewPromptItem
} from "@/lib/ai-review-prompt";

const DEFAULT_GEMINI_REVIEW_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_GEMINI_REVIEW_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash"
] as const;
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001"
]);
const workingModelByConfiguredModel = new Map<string, string>();

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
  const candidates = uniqueModels([
    workingModelByConfiguredModel.get(model),
    model,
    DEFAULT_GEMINI_REVIEW_MODEL,
    ...FALLBACK_GEMINI_REVIEW_MODELS
  ]);
  const failures: string[] = [];

  for (const selectedModel of candidates) {
    const { response, payload } = await requestGeminiReview(apiKey, selectedModel, prompts);
    if (response.ok && !payload?.error) {
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
      workingModelByConfiguredModel.set(model, selectedModel);
      return { response: text, model: `Gemini · ${selectedModel}` };
    }

    failures.push(geminiError(response.status, payload?.error, selectedModel));
    if (!shouldTryGeminiFallback(response.status)) break;
  }

  throw new Error(
    `Gemini не успя да използва наличните модели. ${failures.at(-1) ?? "Неизвестна грешка."}`
  );
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
          maxOutputTokens: 8_000,
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

function uniqueModels(models: Array<string | undefined>) {
  return [...new Set(models.filter((model): model is string => Boolean(model)))];
}

function shouldTryGeminiFallback(status: number) {
  return status === 404 || status === 429 || status >= 500;
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
