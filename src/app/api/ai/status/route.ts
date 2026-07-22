import { checkCloudflareAi } from "@/lib/cloudflare-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkCloudflareAi();
  return Response.json(status, {
    status: status.active ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
