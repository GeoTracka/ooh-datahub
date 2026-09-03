import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  adjustCampaignPlan,
  buildCampaignPlan,
  getPlanMap,
  parsePlanChangeToolInput,
  PlanChangeToolSchema,
} from "@/server/ai/tools/plannerTools";
import { validBrief } from "../../fixtures/aiRuntime";

describe("build_campaign_plan", () => {
  it("publishes a flat OpenAI strict schema for plan changes", () => {
    const schema = z.toJSONSchema(PlanChangeToolSchema) as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    expect(schema.oneOf).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
    expect([...(schema.required as string[])].sort()).toEqual(
      Object.keys(properties).sort(),
    );
    expect(
      parsePlanChangeToolInput({
        kind: "budget",
        budgetNgn: 20_000_000,
        flightStart: null,
        flightEnd: null,
        daypart: null,
        siteIds: null,
        removeZoneId: null,
        addZoneId: null,
        optionId: null,
      }),
    ).toEqual({ kind: "budget", budgetNgn: 20_000_000 });
  });

  it("returns three deterministic approaches without selecting one", async () => {
    const result = await buildCampaignPlan(validBrief);
    expect(result.options).toHaveLength(3);
    expect(result.options.map((option) => option.style)).toEqual([
      "best_overall",
      "maximum_delivery",
      "budget_smart",
    ]);
    expect(new Set(result.options.map((option) => option.candidate.id)).size).toBe(3);
    expect(result.selectedOptionId).toBeNull();
    expect(await buildCampaignPlan(validBrief)).toEqual(result);
  });

  it("keeps recommendation language optional and explains each trade-off", async () => {
    const result = await buildCampaignPlan(validBrief);
    expect(result.options.every((option) => option.tradeoffs.length > 0)).toBe(true);
    expect(result.assumptions.join(" ")).not.toMatch(/guarantee|booked|available now/i);
  });

  it("allows an explicit option choice and returns ID-only map state", async () => {
    const result = await buildCampaignPlan(validBrief);
    const chosen = result.options[1];
    const selected = adjustCampaignPlan(result, {
      kind: "selected_option",
      optionId: chosen.id,
    });
    expect(selected.selectedOptionId).toBe(chosen.id);
    expect(getPlanMap(selected, 2)).toEqual({
      type: "map",
      version: 1,
      planRevision: 2,
      zoneIds: chosen.candidate.zoneIds,
      siteIds: chosen.candidate.siteIds,
      selectedFeatureId: null,
    });
  });
});
