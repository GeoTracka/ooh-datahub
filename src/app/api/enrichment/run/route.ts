import { NextResponse } from "next/server";
import {
  accessGrantForRequest,
  assertGrantCallAllowance,
  enrichmentHttpStatus,
} from "@/server/enrichment/access";
import { RunBodySchema } from "@/server/enrichment/requestSchemas";
import { runtimeEnrichmentGateway } from "@/server/enrichment/runtime";

export async function POST(request: Request) {
  try {
    const body = RunBodySchema.parse(await request.json());
    const grant = accessGrantForRequest(request);
    assertGrantCallAllowance(grant, body.rows);
    const result = await runtimeEnrichmentGateway.run({
      ...body,
      principalId: grant?.principalId ?? null,
      grantId: grant?.grantId ?? null,
    });
    if (grant) {
      console.info(JSON.stringify({
        event: "enrichment_run",
        principalId: grant.principalId,
        tenantId: grant.tenantId,
        grantId: grant.grantId,
        providerCalls: body.rows.filter((row) => Boolean(row.address)).length,
      }));
    }
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_ENRICHMENT_RUN";
    return NextResponse.json({ error: code }, { status: enrichmentHttpStatus(code) });
  }
}
