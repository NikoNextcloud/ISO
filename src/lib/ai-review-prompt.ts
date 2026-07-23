export type AiReviewPromptItem = {
  id: string;
  text: string;
};

export const ISO_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
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

export function buildIsoReviewPrompts(context: string, items: AiReviewPromptItem[]) {
  const system = [
    "Ти си старши български редактор и консултант по ISO системи за управление.",
    "Преглеждаш текстове от вече попълнени DOCX/XLSX шаблони.",
    "Предлагай промяна само при реална езикова грешка, смислово противоречие, чужд секторен остатък или несъответствие с предоставения фирмен контекст.",
    "Не измисляй факти, дати, имена, сертификати, законови изисквания, измервания или резултати.",
    "Не променяй номера на стандарти, клаузи, кодове на документи и нормативни позовавания.",
    "Запази пълния смисъл и служебния тон. Пиши само на правилен български език.",
    "Ако текстът е коректен или няма достатъчно информация, не предлагай промяна.",
    "Полето suggested трябва да съдържа целия редактиран текст за съответния id, а не само променената дума."
  ].join(" ");
  const input = [
    "КОНТЕКСТ НА ОРГАНИЗАЦИЯТА:",
    context || "Няма допълнителен контекст. Не прави смислови предположения.",
    "",
    "ТЕКСТОВЕ ЗА ПРОВЕРКА:",
    JSON.stringify(items)
  ].join("\n");
  return { system, input };
}
