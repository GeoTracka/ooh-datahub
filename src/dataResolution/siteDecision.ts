import { z } from "zod";
import { stableResolutionId } from "./normalize";

const SiteIdentityDecisionInputSchema = z.object({
  siteId: z.string().min(1),
  decisionStatus: z.enum(["confirmed", "rejected"]),
  decisionMethod: z.enum(["field_verification", "authoritative_registry", "manual_review"]),
  evidenceSourceId: z.string().min(1),
  evidenceRevision: z.string().min(1),
});

export type ValidSiteIdentityDecision = {
  decisionId: string;
  siteId: string;
  decisionStatus: "confirmed" | "rejected";
  decisionMethod: "field_verification" | "authoritative_registry" | "manual_review";
  evidenceSourceId: string;
  evidenceRevision: string;
};

export function validateSiteIdentityDecision(input: unknown): ValidSiteIdentityDecision {
  const parsed = SiteIdentityDecisionInputSchema.parse(input);
  return {
    decisionId: stableResolutionId(
      "site-decision",
      parsed.siteId,
      parsed.evidenceSourceId,
      parsed.evidenceRevision,
    ),
    ...parsed,
  };
}
