import { describe, expect, it } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import { canonicalJson } from "@/shared/canonicalJson";
import {
  SURVEY_PLANNING_OBJECTIVES,
  type SurveyPlanningObjective,
} from "@/survey/contextSignals";
import { selectLagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";

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

describe("consumer survey planning-context isolation", () => {
  it.each(SURVEY_PLANNING_OBJECTIVES)(
    "selects the %s artifact without mutating planner output or ordering",
    (objective) => {
      const brief = briefFor(objective);
      const before = buildPlan(bundle, brief);
      const beforeIdentity = canonicalJson(before);
      const beforeOrder = before.packageOptions.map(({ candidate }) =>
        candidate.id,
      );

      const artifact = selectLagosPlanningContextArtifact(objective);

      expect(artifact.objective).toBe(objective);
      expect(artifact.signals).toHaveLength(3);
      expect(canonicalJson(before)).toBe(beforeIdentity);

      const after = buildPlan(bundle, brief);
      expect(canonicalJson(after)).toBe(beforeIdentity);
      expect(after.packageOptions.map(({ candidate }) => candidate.id)).toEqual(
        beforeOrder,
      );
      expect(after.recommended.id).toBe(before.recommended.id);
      expect(after.measurement).toEqual(before.measurement);
    },
  );
});
