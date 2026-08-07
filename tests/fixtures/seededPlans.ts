import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { RfqReviewInput } from "@/contracts/rfq";
import { optimizePackage } from "@/planning/packageOptimizer";

export const seededFmcgPlan = optimizePackage(frozenLagosBundle, {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
});

export const deterministicReview: RfqReviewInput = {
  buyerContact: { name: "Demo Buyer", email: "buyer@example.test" },
  responseDeadline: "2026-08-20",
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
  datesConfirmed: true,
  supplierNotes: {},
};
