import { Settings } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Ти си AI асистент в приложението ISO Smart Manager AI.
Помагаш на ISO консултанти да изграждат и поддържат интегрирани системи за управление по ISO 9001, 14001, 45001, 27001 и 50001.
Отговаряй на български език, професионално и стегнато. Когато е уместно, предлагай конкретни текстове за документи, процедури, рискове или KPI.`;

/**
 * Изпраща заявка към Cloudflare Workers AI през конфигуриран Worker endpoint.
 * Очакван Worker: POST { model, messages } → { response } или OpenAI-съвместим формат.
 */
export async function callWorkerAI(settings: Settings, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(settings.aiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.aiModel,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`AI endpoint отговори със статус ${res.status}`);
  const data = await res.json();
  // Поддържани формати: {response}, {result:{response}}, OpenAI {choices:[{message:{content}}]}
  return (
    data.response ??
    data.result?.response ??
    data.choices?.[0]?.message?.content ??
    JSON.stringify(data)
  );
}

export type LocalIntent =
  | { kind: "create_policy" }
  | { kind: "create_procedure"; topic: string }
  | { kind: "add_risk"; topic: string }
  | { kind: "add_kpi" }
  | { kind: "create_register" }
  | { kind: "risk_assessment" }
  | { kind: "help" }
  | { kind: "unknown" };

/** Локален разбор на команди — работи и без конфигуриран AI endpoint. */
export function parseIntent(text: string): LocalIntent {
  const t = text.toLowerCase();
  const topic = (after: RegExp) => {
    const m = t.match(after);
    return m?.[1]?.trim() || "";
  };
  if (/(политика)/.test(t)) return { kind: "create_policy" };
  if (/(процедура)/.test(t)) return { kind: "create_procedure", topic: topic(/процедура(?:\s+за)?\s+(.+)/) };
  if (/(добави|нов).*(риск)|риск за/.test(t)) return { kind: "add_risk", topic: topic(/риск(?:\s+за)?\s+(.+)/) };
  if (/kpi|кипиай|показател/.test(t)) return { kind: "add_kpi" };
  if (/регистър/.test(t)) return { kind: "create_register" };
  if (/оценка.*риск/.test(t)) return { kind: "risk_assessment" };
  if (/помощ|какво можеш|help/.test(t)) return { kind: "help" };
  return { kind: "unknown" };
}

export const HELP_TEXT = `Мога да изпълнявам команди директно върху системата на избрания клиент:

- „Направи политика за качество“ — генерира документ Политика
- „Направи процедура за рекламации“ — генерира нова процедура
- „Добави нов риск за киберсигурност“ — регистрира риск
- „Добави KPI“ — създава цел с показател
- „Направи регистър на документите“ — генерира регистър
- „Направи оценка на риска“ — обобщава текущата оценка

Ако конфигурираш Cloudflare Workers AI endpoint в Настройки, ще отговарям и на свободни въпроси с езиков модел.`;
