import { describe, expect, it } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import { canonicalJson } from "@/shared/canonicalJson";
import {
  SURVEY_PLANNING_OBJECTIVES,
  type SurveyPlanningObjective,
} from "@/survey/contextSignals";
import {
  resolveLagosPlanningContext,
  type SurveyAudienceLensChoice,
} from "@/survey/lagosPlanningContext";

const baseBrief: Brief = {
  productName: "Spark Refresh",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

function briefFor(objective: SurveyPlanningObjective): Brief {
  return { ...baseBrief, objective };
}

const choices: Array<[string, SurveyAudienceLensChoice]> = [
  ["automatic", { mode: "automatic" }],
  ["confirmed automatic", { mode: "manual", profileId: "ageBand:18-25" }],
  [
    "manual published segment",
    { mode: "manual", profileId: "occupation:business-trader" },
  ],
  ["manual all-Lagos sample", { mode: "manual", profileId: null }],
];

describe("consumer survey planning-context isolation", () => {
  it.each(SURVEY_PLANNING_OBJECTIVES)(
    "keeps %s planner output byte-identical for every audience-lens choice",
    (objective) => {
      const brief = briefFor(objective);
      const briefIdentity = canonicalJson(brief);
      const before = buildPlan(bundle, brief);
      const beforeIdentity = canonicalJson(before);
      const beforeOrder = before.packageOptions.map(
        ({ candidate }) => candidate.id,
      );

      for (const [label, choice] of choices) {
        const context = resolveLagosPlanningContext({
          objective,
          brief,
          choice,
        });

        expect(context.artifact.objective, label).toBe(objective);
        expect(context.artifact.signals, label).toHaveLength(3);
        expect(context.artifact.decisionUse, label).toBe("context_only");
        expect(context.artifact.claimBoundary, label).toBe(
          "self_reported_consumer_context_not_observed_delivery",
        );
        expect(canonicalJson(brief), label).toBe(briefIdentity);
        expect(canonicalJson(before), label).toBe(beforeIdentity);

        const after = buildPlan(bundle, brief);
        expect(canonicalJson(after), label).toBe(beforeIdentity);
        expect(
          after.packageOptions.map(({ candidate }) => candidate.id),
          label,
        ).toEqual(beforeOrder);
        expect(after.recommended.id, label).toBe(before.recommended.id);
        expect(after.measurement, label).toEqual(before.measurement);
      }
    },
    30_000,
  );
});
