import { NextResponse } from "next/server";
import { RunBodySchema } from "@/server/enrichment/requestSchemas";
import { runtimeEnrichmentGateway } from "@/server/enrichment/runtime";

export async function POST(request: Request) {
  try {
    const body = RunBodySchema.parse(await request.json());
    return NextResponse.json(await runtimeEnrichmentGateway.run(body));
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "INVALID_ENRICHMENT_RUN";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
