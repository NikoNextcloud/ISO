import { NextResponse } from "next/server";
import { generateDocumentDraft } from "@/lib/ai";
import type { AiDraftRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiDraftRequest;

    if (!body.organizationId || !body.prompt || !Array.isArray(body.standards)) {
      return NextResponse.json({ error: "organizationId, prompt and standards are required." }, { status: 400 });
    }

    const draft = await generateDocumentDraft(body);
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected AI draft error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
