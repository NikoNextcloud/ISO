import {
  buildIsoReviewPrompts,
  ISO_REVIEW_JSON_SCHEMA,
  type AiReviewPromptItem
} from "@/lib/ai-review-prompt";

const DEFAULT_OPENAI_REVIEW_MODEL = "gpt-5-mini";

type OpenAiResponse = {
  error?: { message?: string; code?: string };
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

export function hasOpenAiConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openAiReviewModel() {
  return process.env.OPENAI_REVIEW_MODEL?.trim() || DEFAULT_OPENAI_REVIEW_MODEL;
}

export async function generateOpenAiTextReview(context: string, items: AiReviewPromptItem[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = openAiReviewModel();
  if (!apiKey) throw new Error("Липсва OPENAI_API_KEY във Vercel.");
  if (!items.length) return { response: '{"suggestions":[]}', model: `OpenAI · ${model}` };

  const prompts = buildIsoReviewPrompts(context, items);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: prompts.system,
      input: prompts.input,
      store: false,
      max_output_tokens: 6_000,
      text: {
        format: {
          type: "json_schema",
          name: "iso_document_review",
          strict: true,
          schema: ISO_REVIEW_JSON_SCHEMA
        }
      }
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000)
  });
  const payload = await response.json().catch(() => null) as OpenAiResponse | null;
  if (!response.ok || payload?.error) {
    throw new Error(openAiError(response.status, payload?.error));
  }
  const text = extractOpenAiOutputText(payload);
  if (!text) throw new Error("OpenAI върна празен текстов преглед.");
  return { response: text, model: `OpenAI · ${model}` };
}

export function extractOpenAiOutputText(payload: OpenAiResponse | null) {
  if (payload?.output_text?.trim()) return payload.output_text.trim();
  for (const output of payload?.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error(`OpenAI отказа заявката: ${content.refusal}`);
      }
      if (content.type === "output_text" && content.text?.trim()) return content.text.trim();
    }
  }
  return "";
}

function openAiError(status: number, error?: OpenAiResponse["error"]) {
  const detail = error?.message?.trim();
  if (status === 401) return "OpenAI API ключът е невалиден или е изтекъл.";
  if (status === 403) return "OpenAI API ключът няма достъп до избрания модел.";
  if (status === 404) return "Избраният OpenAI модел не е намерен или не е достъпен за проекта.";
  if (status === 429) return detail || "Достигнат е лимитът или наличният бюджет на OpenAI API.";
  if (status >= 500) return "OpenAI временно не е достъпен.";
  return detail ? `OpenAI: ${detail}` : `OpenAI върна HTTP грешка ${status}.`;
}
