import type { AiDraftRequest } from "./types";

export type AiDraftResponse = {
  title: string;
  summary: string;
  sections: string[];
  provider: "mock" | "cloudflare" | "openai";
};

export async function generateDocumentDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (provider === "mock") {
    return {
      title: "Чернова: " + request.prompt.slice(0, 60),
      summary:
        "AI слой placeholder: тук ще се върже Cloudflare AI или друг доставчик за генериране на ISO документи от данните за организацията.",
      sections: [
        "Контекст и обхват",
        "Приложими стандарти: " + request.standards.join(", "),
        "Идентифицирани процеси и рискове",
        "Необходими мерки, записи и отговорности"
      ],
      provider: "mock"
    };
  }

  if (provider === "cloudflare") {
    return generateWithCloudflare(request);
  }

  if (provider === "openai") {
    return generateWithOpenAI(request);
  }

  throw new Error(`Unsupported AI provider "${provider}".`);
}

function buildPrompt(request: AiDraftRequest) {
  return [
    "Ти си експерт по ISO интегрирани системи за управление.",
    "Отговори на български език.",
    `Приложими стандарти: ${request.standards.join(", ")}.`,
    "Създай структурирана чернова с обхват, рискове, мерки, записи и отговорности.",
    `Заявка: ${request.prompt}`
  ].join("\n");
}

async function generateWithCloudflare(request: AiDraftRequest): Promise<AiDraftResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";

  if (!accountId || !token) {
    throw new Error("Cloudflare AI is selected but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You generate ISO IMS implementation drafts." },
        { role: "user", content: buildPrompt(request) }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Cloudflare AI request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { result?: { response?: string } };
  const text = data.result?.response ?? "Няма върнат текст от Cloudflare AI.";

  return {
    title: "AI чернова",
    summary: text,
    sections: text.split("\n").filter(Boolean).slice(0, 8),
    provider: "cloudflare"
  };
}

async function generateWithOpenAI(request: AiDraftRequest): Promise<AiDraftResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OpenAI is selected but OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(request)
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { output_text?: string };
  const text = data.output_text ?? "Няма върнат текст от OpenAI.";

  return {
    title: "AI чернова",
    summary: text,
    sections: text.split("\n").filter(Boolean).slice(0, 8),
    provider: "openai"
  };
}
