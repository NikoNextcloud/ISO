const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

type CloudflareEnvelope = {
  success?: boolean;
  result?: { image?: string } | string;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ message?: string }>;
};

export type CloudflareAiStatus = {
  active: boolean;
  configured: boolean;
  model: string;
  message: string;
};

export type AiVisualRequest = {
  type: string;
  prompt: string;
  companyName?: string;
  standard?: string;
  accent?: string;
  layout?: string;
};

function configuration() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CLOUDFLARE_AI_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "",
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_AI_TOKEN ?? process.env.CF_API_TOKEN ?? "",
    model: process.env.CLOUDFLARE_AI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL
  };
}

export async function checkCloudflareAi(): Promise<CloudflareAiStatus> {
  const config = configuration();
  const missing = [
    !config.accountId ? "CLOUDFLARE_ACCOUNT_ID" : "",
    !config.apiToken ? "CLOUDFLARE_API_TOKEN" : ""
  ].filter(Boolean);
  if (missing.length) {
    return {
      active: false,
      configured: false,
      model: config.model,
      message: `Липсват настройки във Vercel: ${missing.join(", ")}.`
    };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/models/search?search=flux-1-schnell&per_page=1`,
      {
        headers: { Authorization: `Bearer ${config.apiToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as CloudflareEnvelope | null;
      return { active: false, configured: true, model: config.model, message: cloudflareError(response.status, payload) };
    }
    return {
      active: true,
      configured: true,
      model: config.model,
      message: "Връзката с Cloudflare Workers AI работи."
    };
  } catch (error) {
    return {
      active: false,
      configured: true,
      model: config.model,
      message: error instanceof Error && error.name === "TimeoutError"
        ? "Cloudflare AI не отговори до 10 секунди."
        : `Неуспешна връзка с Cloudflare AI: ${error instanceof Error ? error.message : "неизвестна грешка"}`
    };
  }
}

export async function generateCloudflareVisual(input: AiVisualRequest) {
  const config = configuration();
  if (!config.accountId || !config.apiToken) {
    throw new Error("Липсват CLOUDFLARE_ACCOUNT_ID или CLOUDFLARE_API_TOKEN във Vercel.");
  }
  const prompt = input.prompt?.trim();
  if (!prompt) throw new Error("Опишете визуализацията, която искате да бъде генерирана.");
  if (prompt.length > 1800) throw new Error("Описанието е твърде дълго. Максимумът е 1800 знака.");

  const fullPrompt = [
    "Create a clean professional flat 2D visual for an ISO management system document.",
    `Visual type: ${input.type || "process diagram"}.`,
    input.companyName ? `Organization: ${input.companyName}.` : "",
    input.standard ? `Management standard: ${input.standard}.` : "",
    `Content: ${prompt}`,
    `Color palette: white background with ${input.accent || "blue and teal"} accents.`,
    `Layout: ${input.layout || "landscape"}.`,
    "Use crisp thick lines, large high-contrast shapes, strong visual hierarchy and a restrained corporate style.",
    "The visual must fill at least 85 percent of the canvas with narrow outer margins and no large empty areas.",
    "Keep the composition simple and legible: use only a few large elements and avoid tiny boxes, thin connectors or miniature details.",
    "Do not add a logo, watermark, certification seal or invented numerical results.",
    "Do not render any text, words, letters or captions inside the image. Use shapes, icons, connectors and neutral numbered markers only.",
    "The application will add verified Bulgarian Cyrillic titles and descriptions after generation."
  ].filter(Boolean).join(" ");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${config.model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: fullPrompt, steps: 6 }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000)
    }
  );

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/") && response.ok) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return { dataUrl: `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`, model: config.model };
  }

  const payload = await response.json().catch(() => null) as CloudflareEnvelope | null;
  if (!response.ok || payload?.success === false) throw new Error(cloudflareError(response.status, payload));
  const image = typeof payload?.result === "string" ? payload.result : payload?.result?.image;
  if (!image) throw new Error("Cloudflare AI върна отговор без изображение.");
  return { dataUrl: `data:image/jpeg;base64,${image}`, model: config.model };
}

function cloudflareError(status: number, payload: CloudflareEnvelope | null) {
  const detail = payload?.errors?.map((item) => item.message).filter(Boolean).join("; ")
    || payload?.messages?.map((item) => item.message).filter(Boolean).join("; ");
  if (detail) return `Cloudflare AI: ${detail}`;
  if (status === 401) return "Cloudflare API token е невалиден или е изтекъл.";
  if (status === 403) return "Cloudflare API token няма Workers AI Read/Edit права.";
  if (status === 404) return "Cloudflare Account ID или избраният AI модел не е намерен.";
  if (status === 429) return "Достигнат е лимитът на Cloudflare AI. Опитайте отново след малко.";
  if (status >= 500) return "Cloudflare AI временно не е достъпен.";
  return `Cloudflare AI върна HTTP грешка ${status}.`;
}
