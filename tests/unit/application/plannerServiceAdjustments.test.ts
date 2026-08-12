import { describe, expect, it } from "vitest";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import {
  buildPlan,
  listAdjustmentOptions,
  replaceZoneWithZone,
} from "@/application/plannerService";
import type { Brief } from "@/contracts/domain";

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

describe("fine-tune adjustment options", () => {
  it("exposes only explicit compatible choices with human labels", () => {
    const plan = buildPlan(bundle, brief);
    const options = listAdjustmentOptions(bundle, plan);
    const selectedIds = new Set(plan.recommended.siteIds);
    const selectedZones = new Set(plan.selectedZoneIds);

    expect(options.selectedSites.map((site) => site.id)).toEqual(plan.recommended.siteIds);
    expect(options.selectedSites.every((site) => site.label && site.zoneLabel)).toBe(true);
    expect(options.addableSites.every((site) =>
      selectedZones.has(site.zoneId) && !selectedIds.has(site.id)
    )).toBe(true);
    expect(options.alternativeZones.every((zone) => !selectedZones.has(zone.id))).toBe(true);
    for (const selected of options.selectedSites) {
      expect((options.replacementSitesBySelectedSite[selected.id] ?? []).every((replacement) =>
        replacement.zoneId === selected.zoneId && !selectedIds.has(replacement.id)
      )).toBe(true);
    }
  });

  it("replaces only the user-selected source zone with the user-selected target zone", () => {
    const plan = buildPlan(bundle, brief);
    const options = listAdjustmentOptions(bundle, plan);
    expect(options.alternativeZones.length).toBeGreaterThan(0);

    const source = options.selectedZones[0];
    const target = options.alternativeZones[0];
    const next = replaceZoneWithZone(bundle, plan, source.id, target.id);

    expect(next.selectedZoneIds).not.toContain(source.id);
    expect(next.selectedZoneIds).toContain(target.id);
    expect(next.selectedZoneIds).toHaveLength(3);
  });
});
