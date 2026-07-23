import { NextRequest } from "next/server";
import { authorizeIsoExport, createIsoSystemArchive, iso902027ExportConfig, isoExportReportHeaders, loadActiveTemplatePackage, type IsoExportRequest } from "@/lib/iso-system-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!await authorizeIsoExport(request)) return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    const result = await createIsoSystemArchive(await request.json() as IsoExportRequest, iso902027ExportConfig, await loadActiveTemplatePackage(request, iso902027ExportConfig.code));
    return new Response(new Uint8Array(result.archive), { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      "Cache-Control": "no-store",
      "X-Document-Count": String(result.documentCount), ...isoExportReportHeaders(result.report)
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неуспешно генериране на системата.";
    return Response.json({ error: message }, { status: 500 });
  }
}
