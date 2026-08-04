import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenLagosBundle } from "../src/bundle/loadFrozenBundle";
import type { Brief } from "../src/contracts/domain";
import type { RfqReviewInput } from "../src/contracts/rfq";
import { optimizePackage } from "../src/planning/packageOptimizer";
import { generateRfq } from "../src/planning/rfq";
import { canonicalJson } from "../src/shared/canonicalJson";

const common = {
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
} as const;

const briefs: Brief[] = [
  {
    ...common,
    productName: "Demo Spark",
    productDescription: "Affordable on-the-go refreshment launch",
    targetAudience: "Students, young workers, and convenience shoppers",
    sector: "fmcg",
    objective: "broad_reach",
  },
  {
    ...common,
    productName: "Demo Residences",
    productDescription: "Mid-market residential development launch",
    targetAudience: "Professionals, investors, and diaspora buyers",
    sector: "real_estate",
    objective: "influential_core",
  },
  {
    ...common,
    productName: "DemoPay",
    productDescription: "Merchant and consumer payments launch",
    targetAudience: "Merchants, students, and urban professionals",
    sector: "bank_fintech",
    objective: "near_conversion",
  },
];

export function buildGoldenOutputs() {
  return Object.fromEntries(briefs.map((brief) => {
    const plan = optimizePackage(frozenLagosBundle, brief);
    const review: RfqReviewInput = {
      buyerContact: { name: "Demo Buyer", email: "buyer@example.test" },
      responseDeadline: "2026-08-20",
      flightStart: brief.flightStart,
      flightEnd: brief.flightEnd,
      datesConfirmed: true,
      supplierNotes: {},
    };
    return [brief.sector, {
      plan,
      rfq: generateRfq(frozenLagosBundle, plan, review),
    }];
  }));
}

const outputPath = resolve("src/demo/lagos-v1/golden-outputs.json");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, canonicalJson(buildGoldenOutputs()) + "\n", "utf8");
  const verified = readFileSync(outputPath, "utf8");
  if (verified !== canonicalJson(buildGoldenOutputs()) + "\n") {
    throw new Error("GOLDEN_WRITE_NOT_REPRODUCIBLE");
  }
}
