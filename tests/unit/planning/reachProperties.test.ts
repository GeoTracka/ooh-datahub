import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";

const baseRequest = {
  sector: "fmcg" as const,
  daypart: "pm" as const,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("reach invariants", () => {
  it("keeps reach within universe and compatible target OTS", () => {
    const result = estimatePackage(frozenLagosBundle, {
      ...baseRequest,
      siteIds: ["yaba-face-1", "ikeja-face-1", "oshodi-face-1"],
    });
    const universe = result.claim.kind === "scenario_target_reach"
      ? result.claim.universe
      : 0;
    for (const scenario of result.scenarios) {
      expect(scenario.reach).not.toBeNull();
      expect(scenario.reach!).toBeLessThanOrEqual(universe);
      expect(scenario.reach!).toBeLessThanOrEqual(scenario.targetOts!);
      expect(scenario.averageFrequency!).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps add/remove reach monotone for fixed delivery subsets", () => {
    const ids = frozenLagosBundle.sites.map((site) => site.id);
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: ids.length - 1 }), {
        minLength: 1,
        maxLength: 4,
      }),
      fc.integer({ min: 0, max: ids.length - 1 }),
      (indices, extraIndex) => {
        fc.pre(!indices.includes(extraIndex));
        const selected = indices.map((index) => ids[index]);
        const smaller = estimatePackage(frozenLagosBundle, {
          ...baseRequest,
          siteIds: selected,
        });
        const larger = estimatePackage(frozenLagosBundle, {
          ...baseRequest,
          siteIds: [...selected, ids[extraIndex]],
        });
        expect(larger.scenarios[1].reach!)
          .toBeGreaterThanOrEqual(smaller.scenarios[1].reach!);
        expect(smaller.scenarios[1].reach!)
          .toBeLessThanOrEqual(larger.scenarios[1].reach!);
      },
    ), { seed: 260803, numRuns: 75 });
  });

  it("keeps every exact leave-one-out marginal non-negative", () => {
    const siteIds = ["yaba-face-1", "ikeja-face-1", "oshodi-face-1", "vi-face-1"];
    const full = estimatePackage(frozenLagosBundle, { ...baseRequest, siteIds });
    for (const removed of siteIds) {
      const reduced = estimatePackage(frozenLagosBundle, {
        ...baseRequest,
        siteIds: siteIds.filter((siteId) => siteId !== removed),
      });
      expect(full.scenarios[1].reach! - reduced.scenarios[1].reach!)
        .toBeGreaterThanOrEqual(0);
    }
  });
});
