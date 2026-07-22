import { type NextRequest } from "next/server";
import { generateCloudflareVisual, type AiVisualRequest } from "@/lib/cloudflare-ai";
import { authorizeIsoExport } from "@/lib/iso-system-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (!await authorizeIsoExport(request)) {
      return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    }
    const result = await generateCloudflareVisual(await request.json() as AiVisualRequest);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI визуализацията не беше генерирана.";
    return Response.json({ error: message }, { status: 500 });
  }
}
