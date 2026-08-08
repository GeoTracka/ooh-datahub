import { NextResponse } from "next/server";
import {
  accessGrantForRequest,
  assertGrantCallAllowance,
  enrichmentHttpStatus,
} from "@/server/enrichment/access";
import { disabledCapabilities } from "@/server/enrichment/providers/disabledProvider";
import { PreflightBodySchema } from "@/server/enrichment/requestSchemas";
import { runtimeEnrichmentGateway } from "@/server/enrichment/runtime";

export async function POST(request: Request) {
  try {
    const body = PreflightBodySchema.parse(await request.json());
    const grant = accessGrantForRequest(request);
    assertGrantCallAllowance(grant, body.rows);
    const preflight = runtimeEnrichmentGateway.preflight({
      ...body,
      principalId: grant?.principalId ?? null,
      grantId: grant?.grantId ?? null,
    });
    if (grant) {
      console.info(JSON.stringify({
        event: "enrichment_preflight",
        principalId: grant.principalId,
        tenantId: grant.tenantId,
        grantId: grant.grantId,
        maximumCalls: preflight.maximumCalls,
      }));
    }
    return NextResponse.json({
      ...preflight,
      retention:
        "Geocoding content expires within 30 consecutive days; place IDs are separate",
      attribution: "Google Maps",
      eligibility:
        "Geocodes are review/context only; not calibration or MapLibre inputs",
      costEstimate: "Cost unavailable — rate card not configured",
      pricingRevision: null,
      disabledCapabilities,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_PREFLIGHT";
    return NextResponse.json({ error: code }, { status: enrichmentHttpStatus(code) });
  }
}
