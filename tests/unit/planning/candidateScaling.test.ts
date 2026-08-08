import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import {
  candidateSiteSetsForPlanning,
  MAX_EXACT_CANDIDATES,
} from "@/planning/packageOptimizer";

const brief = {
  productName: "Scale test",
  productDescription: "General consumer launch",
  targetAudience: "General consumers",
  sector: "fmcg" as const,
  objective: "broad_reach" as const,
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("bounded candidate generation", () => {
  it("caps exact evaluation candidates for a 100-site inventory", () => {
    const scaled = structuredClone(frozenLagosBundle);
    scaled.sites = Array.from({ length: 100 }, (_, index) => {
      const source = frozenLagosBundle.sites[index % frozenLagosBundle.sites.length];
      return {
        ...structuredClone(source),
        id: `scale-site-${String(index + 1).padStart(3, "0")}`,
        label: `${source.label} scale ${index + 1}`,
        rateNgn: source.rateNgn + (index % 7) * 1_000,
      };
    });
    const candidates = candidateSiteSetsForPlanning(scaled, brief);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(MAX_EXACT_CANDIDATES);
    expect(candidates.every((sites) =>
      sites.length >= 3 &&
      sites.length <= 6 &&
      new Set(sites.map((site) => site.zoneId)).size === 3
    )).toBe(true);
  });
});
