import { type NextRequest } from "next/server";
import { generateCloudflareVisual, type AiVisualRequest } from "@/lib/cloudflare-ai";
import { aiRequestHash, consumeAiGeneration, createAiContext, readCachedVisual, saveCachedVisual } from "@/lib/ai-guard";
import { authorizeIsoExport } from "@/lib/iso-system-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!await authorizeIsoExport(request)) {
      return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    }
    const input = await request.json() as AiVisualRequest;
    const context = await createAiContext(request);
    const hash = aiRequestHash(input);
    const cached = await readCachedVisual(context, hash);
    if (cached) {
      return Response.json({ ...cached, cached: true }, { headers: { "Cache-Control": "private, max-age=300", "X-AI-Cache": "HIT" } });
    }
    const limit = await consumeAiGeneration(context, hash);
    if (!limit.allowed) {
      return Response.json(
        { error: "Достигнат е лимитът от 10 нови AI изображения за 15 минути. Вече кешираните изображения остават достъпни." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 900), "Cache-Control": "no-store" } }
      );
    }
    const result = await generateCloudflareVisual(input);
    await saveCachedVisual(context, hash, result);
    return Response.json({ ...result, cached: false }, {
      headers: {
        "Cache-Control": "no-store",
        "X-AI-Cache": "MISS",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": String(limit.remaining ?? 0)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI визуализацията не беше генерирана.";
    return Response.json({ error: message }, { status: 500 });
  }
}
