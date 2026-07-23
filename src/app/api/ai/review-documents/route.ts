import { type NextRequest } from "next/server";
import {
  buildReviewContext,
  createReviewBatches,
  extractReviewSegments,
  normalizeReviewSuggestions,
  parseAiReviewJson,
  type AiDocumentReview,
  type AiReviewSuggestion
} from "@/lib/ai-document-review";
import { aiReviewRequestHash, consumeAiGeneration, createAiContext, readCachedReview, saveCachedReview } from "@/lib/ai-guard";
import { generateCloudflareTextReview } from "@/lib/cloudflare-ai";
import {
  authorizeIsoExport,
  createIsoSystemArchive,
  getIsoExportConfig,
  loadActiveTemplatePackage,
  type IsoExportRequest
} from "@/lib/iso-system-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReviewRequest = IsoExportRequest & { code?: string };

export async function POST(request: NextRequest) {
  try {
    if (!await authorizeIsoExport(request)) {
      return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    }
    const body = await request.json() as ReviewRequest;
    const config = getIsoExportConfig(body.code ?? "");
    if (!config) return Response.json({ error: "Неподдържана ISO система." }, { status: 400 });

    const sourceBody: IsoExportRequest = {
      ...body,
      logoPngDataUrl: "",
      aiVisuals: [],
      aiTextEdits: []
    };
    const generated = await createIsoSystemArchive(
      sourceBody,
      config,
      await loadActiveTemplatePackage(request, config.code)
    );
    const extracted = extractReviewSegments(generated.archive);
    const organizationContext = buildReviewContext(body, config.code);
    const hash = aiReviewRequestHash({
      standard: config.code,
      organizationContext,
      segments: extracted.segments
    });
    const aiContext = await createAiContext(request);
    const cached = await readCachedReview<AiDocumentReview>(aiContext, hash);
    if (cached) {
      return Response.json({ review: cached, report: generated.report, cached: true }, {
        headers: { "Cache-Control": "private, max-age=300", "X-AI-Cache": "HIT" }
      });
    }

    const limit = await consumeAiGeneration(aiContext, hash);
    if (!limit.allowed) {
      return Response.json(
        { error: "Достигнат е лимитът за нови AI операции. Опитайте отново след посоченото време или използвайте вече кеширан преглед." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 900), "Cache-Control": "no-store" } }
      );
    }

    if (!extracted.segments.length) {
      const emptyReview: AiDocumentReview = {
        model: "",
        reviewedFiles: extracted.totalFiles,
        reviewedSegments: 0,
        suggestions: [],
        warnings: ["В документите няма открити достатъчно дълги текстове за смислов AI преглед."]
      };
      await saveCachedReview(aiContext, hash, emptyReview);
      return Response.json({ review: emptyReview, report: generated.report, cached: false });
    }

    const batches = createReviewBatches(extracted.segments);
    const suggestions: AiReviewSuggestion[] = [];
    const warnings: string[] = [];
    let reviewedSegments = 0;
    let model = "";
    await mapWithConcurrency(batches, 3, async (batch, index) => {
      try {
        const result = await generateCloudflareTextReview(
          organizationContext,
          batch.map((segment) => ({ id: segment.id, text: segment.text }))
        );
        model ||= result.model;
        const parsed = parseAiReviewJson(result.response);
        suggestions.push(...normalizeReviewSuggestions(parsed, batch));
        reviewedSegments += batch.length;
      } catch (error) {
        warnings.push(`AI пакет ${index + 1} от ${batches.length} не беше проверен: ${error instanceof Error ? error.message : "неизвестна грешка"}`);
      }
    });
    if (!reviewedSegments) throw new Error(warnings[0] ?? "Cloudflare AI не успя да прегледа документите.");

    const unique = deduplicateSuggestions(suggestions);
    if (unique.length > 300) warnings.push(`Открити са ${unique.length} предложения. Показани са първите 300.`);
    if (extracted.reviewedFiles < extracted.totalFiles) {
      warnings.push(`${extracted.totalFiles - extracted.reviewedFiles} файла съдържат само кратки полета, числа или таблици и са проверени само с автоматичните правила.`);
    }
    const review: AiDocumentReview = {
      model,
      reviewedFiles: extracted.totalFiles,
      reviewedSegments,
      suggestions: unique.slice(0, 300),
      warnings
    };
    await saveCachedReview(aiContext, hash, review);
    return Response.json({ review, report: generated.report, cached: false }, {
      headers: {
        "Cache-Control": "no-store",
        "X-AI-Cache": "MISS",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": String(limit.remaining ?? 0)
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI прегледът не беше завършен." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function deduplicateSuggestions(items: AiReviewSuggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.file}\0${item.original}\0${item.suggested}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.file.localeCompare(b.file, "bg") || b.confidence - a.confidence);
}
