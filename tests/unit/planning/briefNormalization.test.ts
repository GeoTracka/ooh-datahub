import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import {
  applyResolvedAudience,
  resolveBriefAudience,
} from "@/planning/briefNormalization";
import { optimizePackage } from "@/planning/packageOptimizer";

const common = {
  productName: "Focused test",
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("brief audience normalization", () => {
  it("keeps mixed demo audiences on the broad sector preset", () => {
    const resolved = resolveBriefAudience(frozenLagosBundle, {
      sector: "fmcg",
      targetAudience: "Students, young workers, and convenience shoppers",
      productDescription: "Affordable on-the-go refreshment launch",
    });
    expect(resolved.mode).toBe("sector_preset");
    expect(resolved.cellIds).toHaveLength(3);
  });

  it("focuses one strong audience signal into its governed target cell", () => {
    const resolved = resolveBriefAudience(frozenLagosBundle, {
      sector: "bank_fintech",
      targetAudience: "Small business owners and merchants",
      productDescription: "Merchant payments acceptance product",
    });
    expect(resolved).toMatchObject({
      mode: "focused",
      cellIds: ["merchant_owner_users"],
    });
    const scoped = applyResolvedAudience(
      frozenLagosBundle,
      "bank_fintech",
      resolved,
    );
    expect(scoped.targets.filter((target) => target.sector === "bank_fintech")
      .map((target) => target.cellId)).toEqual(["merchant_owner_users"]);
    expect(scoped.panel.every((member) =>
      member.sector !== "bank_fintech" || member.cellId === "merchant_owner_users"
    )).toBe(true);
  });

  it("makes materially different focused audiences change the measurement basis", () => {
    const merchant = optimizePackage(frozenLagosBundle, {
      ...common,
      sector: "bank_fintech",
      objective: "broad_reach",
      targetAudience: "Merchants and business owners",
      productDescription: "Merchant acquiring product",
    });
    const student = optimizePackage(frozenLagosBundle, {
      ...common,
      sector: "bank_fintech",
      objective: "broad_reach",
      targetAudience: "University students on campus",
      productDescription: "Student payments product",
    });
    expect(merchant.measurement?.claim.kind).toBe("scenario_target_reach");
    expect(student.measurement?.claim.kind).toBe("scenario_target_reach");
    expect(merchant.measurement?.fingerprint).not.toBe(student.measurement?.fingerprint);
    if (
      merchant.measurement?.claim.kind === "scenario_target_reach" &&
      student.measurement?.claim.kind === "scenario_target_reach"
    ) {
      expect(merchant.measurement.claim.universe)
        .not.toBe(student.measurement.claim.universe);
    }
  });
});
