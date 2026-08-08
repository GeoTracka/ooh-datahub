import { describe, expect, it } from "vitest";
import { buildPlan, applyUploadContextToPlan } from "@/application/plannerService";
import { selectUploadedContextComparisons } from "@/application/uploadContextSelectors";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";

const brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg" as const,
  objective: "broad_reach" as const,
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("selectUploadedContextComparisons", () => {
  it("compares customer rows transparently without creating delivery eligibility", () => {
    const basis = buildPlan(bundle, brief);
    const withContext = applyUploadContextToPlan(bundle, basis, {
      mode: "context_shortlist",
      decisionUse: "context_only",
      selectedRowIds: ["UP-001"],
      selectedRows: [{
        rowId: "UP-001",
        assetId: "UP-001",
        supplier: "Upload Media",
        address: "Herbert Macaulay Way Yaba Lagos",
        format: "static",
        rateNgn: 3_200_000,
        orientation: "northbound",
        coordinate: {
          value: [3.3717, 6.5158],
          provider: "customer",
          accuracy: "customer-accuracy-25m",
          license: "customer-coordinate-attestation-1",
          sourceArtifactId: "upload-fixture-1",
        },
      }],
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
      fingerprint: "context-selection-v1|fixture",
      claimResolution: {
        highest: "context",
        influenceEligible: false,
        evidenceCap: "D",
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
        recoveryAction: "Provide a feature-compatible calibration bundle",
      },
      planningFit: null,
    });

    const rows = selectUploadedContextComparisons(bundle, withContext);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetId: "UP-001",
      supplier: "Upload Media",
      formatFit: "matches_package",
      decisionUse: "context_only",
      deliveryEligible: false,
    });
    expect(rows[0].nearestSelectedZone?.distanceKm).toBeLessThan(20);
    expect(rows[0].rateDeltaPercent).not.toBeNull();
  });
});
