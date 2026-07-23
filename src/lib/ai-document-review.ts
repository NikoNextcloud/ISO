import { createHash } from "node:crypto";
import { readZip } from "@/lib/zip";
import type { IsoExportRequest } from "@/lib/iso-system-export";

export type AiReviewSegment = {
  id: string;
  text: string;
  files: string[];
};

export type AiReviewSuggestion = {
  id: string;
  file: string;
  original: string;
  suggested: string;
  reason: string;
  category: "language" | "context" | "consistency" | "risk";
  confidence: number;
};

export type AiDocumentReview = {
  model: string;
  reviewedFiles: number;
  reviewedSegments: number;
  suggestions: AiReviewSuggestion[];
  warnings: string[];
};

export type AiReviewBatchResult = {
  suggestions?: Array<{
    id?: string;
    suggested?: string;
    reason?: string;
    category?: string;
    confidence?: number;
  }>;
};

export function extractReviewSegments(archive: Buffer) {
  const entries = readZip(archive).filter((entry) => !entry.directory && /\.(?:docx|xlsx)$/i.test(entry.name));
  const byText = new Map<string, Set<string>>();

  for (const entry of entries) {
    const file = stripArchiveRoot(entry.name);
    const texts = entry.name.toLowerCase().endsWith(".docx")
      ? extractWordParagraphs(entry.data)
      : extractSpreadsheetTexts(entry.data);
    for (const text of texts) {
      for (const candidate of splitLongText(text)) {
        if (!isReviewable(candidate)) continue;
        const files = byText.get(candidate) ?? new Set<string>();
        files.add(file);
        byText.set(candidate, files);
      }
    }
  }

  const segments: AiReviewSegment[] = [];
  let reviewedCharacters = 0;
  for (const [text, files] of byText) {
    reviewedCharacters += text.length;
    segments.push({ id: `s${segments.length + 1}`, text, files: [...files].sort() });
  }
  return {
    segments,
    totalFiles: entries.length,
    reviewedFiles: new Set(segments.flatMap((segment) => segment.files)).size,
    reviewedCharacters
  };
}

export function createReviewBatches(segments: AiReviewSegment[], maxCharacters = 45_000, maxItems = 90) {
  const batches: AiReviewSegment[][] = [];
  let current: AiReviewSegment[] = [];
  let characters = 0;
  for (const segment of segments) {
    const size = segment.text.length + segment.id.length + 30;
    if (current.length && (characters + size > maxCharacters || current.length >= maxItems)) {
      batches.push(current);
      current = [];
      characters = 0;
    }
    current.push(segment);
    characters += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function buildReviewContext(input: IsoExportRequest, standard: string) {
  const fields = [
    ["Стандарт", standard],
    ["Фирма", input.companyName],
    ["ЕИК", input.uic],
    ["Адрес", input.address],
    ["Град", input.city],
    ["Управител", input.manager],
    ["Дейност", input.activity],
    ["Обхват", input.scope],
    ["Физически обхват", input.physicalScope],
    ["Продукти и услуги", input.productsServices],
    ["Контекст", input.organizationContext],
    ["Процеси", input.processesDescription],
    ["Екологични аспекти", input.environmentalAspects],
    ["Рискове по ЗБУТ", input.occupationalRisks],
    ["Заинтересовани страни", input.externalParties],
    ["Управление на отпадъците", input.wasteManagement],
    ["Проектиране и разработване", input.designDevelopment],
    ["Дейности след доставка", input.postDeliveryActivities],
    ["Дата на системата", input.systemDate || input.effectiveDate],
    ["Предходна година", input.previousYear],
    ["Настояща година", input.currentYear]
  ];
  return fields
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([label, value]) => `${label}: ${String(value).trim().slice(0, 2_500)}`)
    .join("\n");
}

export function normalizeReviewSuggestions(
  payload: AiReviewBatchResult,
  batch: AiReviewSegment[]
): AiReviewSuggestion[] {
  const byId = new Map(batch.map((segment) => [segment.id, segment]));
  const result: AiReviewSuggestion[] = [];
  for (const item of payload.suggestions ?? []) {
    const segment = byId.get(String(item.id ?? ""));
    const suggested = typeof item.suggested === "string" ? item.suggested.trim() : "";
    if (!segment || !suggested || suggested === segment.text || suggested.length > 7_500) continue;
    const category = normalizeCategory(item.category);
    const confidence = Number.isFinite(item.confidence) ? Math.min(1, Math.max(0, Number(item.confidence))) : 0.7;
    for (const file of segment.files) {
      result.push({
        id: createHash("sha256").update(`${file}\0${segment.text}\0${suggested}`).digest("hex").slice(0, 20),
        file,
        original: segment.text,
        suggested,
        reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 800) : "Смислова или езикова корекция.",
        category,
        confidence
      });
    }
  }
  return result;
}

export function parseAiReviewJson(value: string): AiReviewBatchResult {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI върна невалиден формат за текстовия преглед.");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as AiReviewBatchResult;
  if (!parsed || !Array.isArray(parsed.suggestions)) throw new Error("AI отговорът няма списък с предложения.");
  return parsed;
}

function extractWordParagraphs(docx: Buffer) {
  const texts: string[] = [];
  for (const entry of readZip(docx)) {
    if (!/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(entry.name)) continue;
    const xml = entry.data.toString("utf8");
    const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/gi) ?? [];
    for (const paragraph of paragraphs) {
      const text = textNodes(paragraph, /<w:(?:t|delText|instrText)\b[^>]*>([\s\S]*?)<\/w:(?:t|delText|instrText)>/gi);
      if (text) texts.push(text);
    }
  }
  return texts;
}

function extractSpreadsheetTexts(xlsx: Buffer) {
  const texts: string[] = [];
  for (const entry of readZip(xlsx)) {
    if (!/^xl\/(?:sharedStrings|worksheets\/sheet\d+|comments\d+)\.xml$/i.test(entry.name)) continue;
    const xml = entry.data.toString("utf8");
    const containers = entry.name.toLowerCase().endsWith("sharedstrings.xml")
      ? xml.match(/<si\b[\s\S]*?<\/si>/gi) ?? []
      : xml.match(/<(?:c|comment)\b[\s\S]*?<\/(?:c|comment)>/gi) ?? [];
    for (const container of containers) {
      const text = textNodes(container, /<(?:[a-z][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-z][\w.-]*:)?t>/gi);
      if (text) texts.push(text);
    }
  }
  return texts;
}

function textNodes(xml: string, pattern: RegExp) {
  const parts: string[] = [];
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) parts.push(decodeXml(match[1]));
  return parts.join("").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function splitLongText(value: string) {
  if (value.length <= 4_000) return [value];
  const chunks: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(value.length, start + 4_000);
    if (end < value.length) {
      const boundary = value.lastIndexOf(" ", end);
      if (boundary > start + 1_000) end = boundary;
    }
    const chunk = value.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
    while (value[start] === " ") start += 1;
  }
  return chunks;
}

function isReviewable(value: string) {
  if (value.length < 35) return false;
  const letters = value.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 20) return false;
  if (value.split(/\s+/).length < 5) return false;
  return !/^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(value);
}

function stripArchiveRoot(value: string) {
  const normalized = value.replaceAll("\\", "/");
  const slash = normalized.indexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function normalizeCategory(value: unknown): AiReviewSuggestion["category"] {
  return value === "language" || value === "context" || value === "consistency" || value === "risk"
    ? value
    : "language";
}
