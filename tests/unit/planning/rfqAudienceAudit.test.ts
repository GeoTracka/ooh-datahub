import { describe, expect, it } from "vitest";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import { resolveBriefAudience } from "@/planning/briefNormalization";
import { generateRfq } from "@/planning/rfq";
import { deterministicReview, seededFmcgPlan } from "../../fixtures/seededPlans";

describe("RFQ audience audit", () => {
  it("records the governed audience basis internally while preserving buyer wording externally", () => {
    const plan = seededFmcgPlan;
    const resolved = resolveBriefAudience(bundle, plan.brief);
    const rfq = generateRfq(bundle, plan, deterministicReview);

    expect(rfq.internalRequest.audiencePlanningBasis.targetDefinition)
      .toBe(resolved.label);
    expect(rfq.internalRequest.campaign.targetAudience)
      .toBe(plan.brief.targetAudience);
    expect(rfq.internalRequest.audiencePlanningBasis.targetDefinition)
      .not.toBe(plan.brief.targetAudience);

    for (const message of rfq.supplierMessages) {
      expect(message.body).toContain("Target audience: " + plan.brief.targetAudience);
      expect(message.body).not.toContain(
        "Target audience: " + resolved.label,
      );
    }
  });
});
