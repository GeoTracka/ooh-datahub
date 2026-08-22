import { describe, expect, it } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import { canonicalJson } from "@/shared/canonicalJson";
import { lagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";
import { SURVEY_PLANNING_OBJECTIVES } from "@/survey/contracts";
import { selectSurveyPlanningContextProfile } from "@/survey/publishedContext";

const brief: Brief = {
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

describe("consumer survey planning-context isolation", () => {
  it.each(SURVEY_PLANNING_OBJECTIVES)(
    "selects the %s presentation profile without mutating planner output",
    (objective) => {
      const objectiveBrief = { ...brief, objective };
      const before = buildPlan(bundle, objectiveBrief);
      const beforeIdentity = canonicalJson(before);

      const profile = selectSurveyPlanningContextProfile(
        lagosPlanningContextArtifact,
        objective,
      );

      expect(profile.objective).toBe(objective);
      expect(profile.signals).toHaveLength(3);
      expect(canonicalJson(before)).toBe(beforeIdentity);
      expect(canonicalJson(buildPlan(bundle, objectiveBrief))).toBe(
        beforeIdentity,
      );
    },
  );
});
