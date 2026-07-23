import { NextRequest } from "next/server";
import { authorizeIsoExport, createIsoSystemArchive, getIsoExportConfig, loadActiveTemplatePackage, type IsoExportRequest } from "@/lib/iso-system-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!await authorizeIsoExport(request)) return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    const body = await request.json() as IsoExportRequest & { code?: string };
    const config = getIsoExportConfig(body.code ?? "");
    if (!config) return Response.json({ error: "Неподдържана ISO система." }, { status: 400 });
    const result = await createIsoSystemArchive(body, config, await loadActiveTemplatePackage(request, config.code));
    return Response.json({ report: result.report, filename: result.filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Предварителната проверка не беше успешна.";
    return Response.json({ error: message }, { status: 500 });
  }
}
