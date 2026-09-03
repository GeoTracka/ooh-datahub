import type { PackageOption, PlanningResult } from "@/contracts/domain";
import { ArtifactPayloadSchema } from "@/server/artifacts/contracts";
import type { PlanArtifactPayload } from "@/server/artifacts/contracts";

const OPTION_COPY = {
  best_overall: {
    title: "Balanced plan",
    tradeoffs: [
      "Balances estimated delivery, planning fit and spend instead of maximising only one measure.",
    ],
  },
  maximum_delivery: {
    title: "Highest delivery",
    tradeoffs: [
      "Prioritises the strongest modelled delivery and may use more of the available budget.",
    ],
  },
  budget_smart: {
    title: "Budget-smart plan",
    tradeoffs: [
      "Reduces planned spend while staying close to the strongest available planning fit.",
    ],
  },
} as const;

function presentOption(option: PackageOption) {
  const copy = OPTION_COPY[option.style];
  return {
    id: option.candidate.id,
    style: option.style,
    title: copy.title,
    candidate: option.candidate,
    tradeoffs: [...copy.tradeoffs],
  };
}

export function presentCampaignPlan(
  result: PlanningResult,
  selectedOptionId: string | null = null,
): PlanArtifactPayload {
  const options = result.packageOptions.map(presentOption);
  if (
    options.length !== 3 ||
    new Set(options.map((option) => option.id)).size !== 3 ||
    options.some((option) => !option.candidate.valid)
  ) {
    throw new Error("THREE_DISTINCT_PLAN_OPTIONS_UNAVAILABLE");
  }
  if (selectedOptionId && !options.some((option) => option.id === selectedOptionId)) {
    throw new Error("SELECTED_PLAN_OPTION_NOT_FOUND");
  }
  return ArtifactPayloadSchema.parse({
    type: "plan",
    version: 1,
    brief: result.brief,
    options,
    selectedOptionId,
    assumptions: [
      "Costs and media details use the current inventory data in this workspace.",
      "Delivery figures are planning estimates based on the selected dates, daypart and locations.",
      "No option is selected automatically; the planner can be fine-tuned before saving.",
    ],
    limitations: [
      "Availability, final rates and booking remain subject to supplier confirmation.",
      "Study findings describe the survey sample and do not replace inventory-based delivery estimates.",
    ],
  }) as PlanArtifactPayload;
}
