import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrozenBundle } from "../src/bundle/bundleSchema";
import { validateFrozenBundle } from "../src/bundle/validateFrozenBundle";
import { canonicalJson } from "../src/shared/canonicalJson";

const zones = [
  { id: "yaba", label: "Yaba / Akoka", center: [3.3792, 6.5158] as [number, number] },
  { id: "ikeja", label: "Ikeja", center: [3.3515, 6.6018] as [number, number] },
  { id: "vi", label: "Victoria Island", center: [3.4219, 6.4281] as [number, number] },
  { id: "oshodi", label: "Oshodi", center: [3.3436, 6.5534] as [number, number] },
  { id: "lekki", label: "Lekki", center: [3.4723, 6.4698] as [number, number] },
];

const targetSeeds = {
  fmcg: [
    ["student_buyers_18_24", 250_000, 0.20, 0.82],
    ["household_nonstudent_buyers_25_44", 240_000, 0.30, 0.88],
    ["residual_convenience_nonstudent_nonhousehold", 310_000, 0.15, 0.91],
  ],
  real_estate: [
    ["diaspora_intenders", 60_000, 0.45, 0.38],
    ["resident_professional_intenders", 180_000, 0.28, 0.66],
    ["resident_nonprofessional_investors", 90_000, 0.40, 0.48],
  ],
  bank_fintech: [
    ["merchant_owner_users", 140_000, 0.35, 0.94],
    ["student_nonmerchant_users", 220_000, 0.18, 0.86],
    ["professional_nonmerchant_nonstudent_users", 280_000, 0.22, 0.92],
  ],
} as const;

// defaultQi and defaultServiceability seed heterogeneous panel members only.
// Runtime delivery uses member-level values, so a member may legitimately differ
// from its cell defaults and the validator must not force equality back onto it.

const dayparts = ["all_day", "am", "midday", "pm", "evening"] as const;
const sectors = ["fmcg", "real_estate", "bank_fintech"] as const;

export function buildDemoBundle(): FrozenBundle {
  const sites = zones.flatMap((zone, zoneIndex) =>
    [0, 1].map((faceIndex) => {
      const index = zoneIndex * 2 + faceIndex;
      const base = 48_000 + index * 7_500;
      return {
        id: zone.id + "-face-" + (faceIndex + 1),
        zoneId: zone.id,
        label: zone.label + " " + (faceIndex === 0 ? "corridor" : "junction"),
        supplierId: "supplier-" + ((index % 3) + 1),
        coordinate: [
          zone.center[0] + (faceIndex === 0 ? -0.004 : 0.004),
          zone.center[1] + (faceIndex === 0 ? 0.003 : -0.003),
        ] as [number, number],
        format: index % 3 === 0 ? "dooh" as const : "static" as const,
        rateNgn: 2_800_000 + index * 240_000,
        baseMovement: {
          all_day: base * 4,
          am: base,
          midday: base * 0.78,
          pm: base * 1.18,
          evening: base * 0.88,
        },
        visibility: 0.44 + (index % 4) * 0.06,
        deliverySchedule: {
          availabilityStart: "2026-01-01",
          availabilityEnd: "2027-12-31",
          uptime: index % 3 === 0 ? 0.90 : 1,
          shareOfTime: index % 3 === 0 ? 0.20 : 1,
          availabilityRevision: "synthetic-availability-r1",
          uptimeRevision: "synthetic-uptime-r1",
          shareOfTimeRevision: "synthetic-sot-r1",
        },
        targetShareBySector: Object.fromEntries(
          sectors.map((sector, sectorIndex) => [
            sector,
            Object.fromEntries(
              targetSeeds[sector].map(([cellId], cellIndex) => [
                cellId,
                0.16 + ((zoneIndex + sectorIndex + cellIndex + faceIndex) % 5) * 0.045,
              ]),
            ),
          ]),
        ),
        planningScoresBySector: Object.fromEntries(
          sectors.map((sector, sectorIndex) => [
            sector,
            {
              A: 55 + ((index + sectorIndex * 3) % 8) * 5,
              C: 50 + ((index * 2 + sectorIndex) % 9) * 5,
              P: 58 + ((zoneIndex + sectorIndex) % 7) * 5,
              E: 52 + ((9 - index + sectorIndex) % 8) * 5,
            },
          ]),
        ),
        available: true,
      };
    }),
  );

  const targets = sectors.flatMap((sector) =>
    targetSeeds[sector].map(([cellId, universe, qi, serviceability]) => ({
      sector,
      cellId,
      universe,
      universeSourceId: "synthetic-" + sector + "-target-universe-v1",
      membership: "mutually_exclusive" as const,
      defaultQi: qi,
      qiSourceId: "synthetic-" + sector + "-influence-v1",
      defaultServiceability: serviceability,
      serviceabilitySourceId: "synthetic-" + sector + "-serviceability-v1",
    })),
  );

  const activityCohort = zones.flatMap((zone, zoneIndex) =>
    Array.from({ length: 6 }, (_, locationIndex) => ({
      id: zone.id + "-activity-" + (locationIndex + 1),
      zoneId: zone.id,
      value: 34_000 + zoneIndex * 9_500 + locationIndex * 4_100,
    })),
  );

  const panel = targets.flatMap((target, targetIndex) =>
    Array.from({ length: 24 }, (_, memberIndex) => ({
      id: target.sector + "-" + target.cellId + "-" + String(memberIndex + 1).padStart(2, "0"),
      sector: target.sector,
      cellId: target.cellId,
      weight: target.universe / 24,
      qi: target.defaultQi,
      serviceability: target.defaultServiceability,
      zoneAffinity: Object.fromEntries(
        zones.map((zone, zoneIndex) => [
          zone.id,
          0.55 + ((memberIndex * 7 + zoneIndex * 3 + targetIndex) % 13) / 10,
        ]),
      ),
      timeAffinity: Object.fromEntries(
        dayparts.map((daypart, daypartIndex) => [
          daypart,
          0.70 + ((memberIndex * 5 + daypartIndex + targetIndex) % 9) / 10,
        ]),
      ),
    })),
  );

  return validateFrozenBundle({
    manifest: {
      id: "lagos-demo-v1",
      geographyId: "lagos-demo-v1",
      schemaVersion: "1.0.0",
      createdAt: "2026-08-03T12:00:00.000Z",
      maximumEvidenceGrade: "D",
      synthetic: true,
      seed: 260803,
      modelVersion: "conditional-poisson-demo-v1",
      featureSnapshotId: "lagos-synthetic-features-v1",
      featureSchemaCompatibilityId: "lagos-context-feature-schema-v1",
      targetUniverseVersion: "lagos-target-universe-v1",
      panelVersion: "weighted-panel-v1",
      replicateSetId: "scenario-low-base-high-v1",
      targetCellPartitionId: "mutually-exclusive-sector-cells-v1",
      targetCellAssignmentRule: "ordered-first-match-with-residual-v1",
      evidenceProfileVersion: "synthetic-evidence-profiles-v1",
      scheduleModelVersion: "inclusive-daily-daypart-v1",
      influenceLinkageAssumptionId: "conditional-independence-within-target-cell-v1",
      influenceSensitivityId: "coherent-exposure-scaling-low-base-high-v1",
      dataRevision: "lagos-demo-data-r1",
    },
    zones,
    sites,
    activityCohort,
    targets,
    targetAllocationSourceIds: Object.fromEntries(
      sectors.map((sector) => [
        sector,
        "synthetic-" + sector + "-target-allocation-v1",
      ]),
    ),
    panel,
    scenarios: [
      { id: "low", movementMultiplier: 0.86, visibilityMultiplier: 0.94, targetShareMultiplier: 0.95, propensityConcentration: 1 },
      { id: "base", movementMultiplier: 1, visibilityMultiplier: 1, targetShareMultiplier: 1, propensityConcentration: 1 },
      { id: "high", movementMultiplier: 1.14, visibilityMultiplier: 1.04, targetShareMultiplier: 1.05, propensityConcentration: 1 },
    ],
    scalingEnvelope: {
      minimumC: 0.000001,
      maximumC: 12,
      maximumMemberLambda: 8,
      maximumAverageFrequency: 12,
    },
    featureRegistry: [
      { id: "poi-attraction", role: "measurement", pillar: null },
      { id: "movement-output", role: "score", pillar: "D" },
      { id: "objective-match", role: "score", pillar: "A" },
      { id: "conversion-context", role: "score", pillar: "C" },
      { id: "portfolio-coverage", role: "score", pillar: "P" },
      { id: "relative-economics", role: "score", pillar: "E" },
    ],
    sourceManifest: [
      { id: "lagos-demo-synthetic-v1", kind: "inventory" as const, sector: null, productScope: "all" as const },
      ...sectors.flatMap((sector) => [
        { id: "synthetic-" + sector + "-influence-v1", kind: "influence" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-target-universe-v1", kind: "target_universe" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-target-allocation-v1", kind: "target_allocation" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-serviceability-v1", kind: "serviceability" as const, sector, productScope: sector },
      ]),
    ].map((source) => ({
      ...source,
      geographyId: "lagos-demo-v1" as const,
      periodStart: "2026-01-01",
      periodEnd: "2027-12-31",
      provenance: "synthetic" as const,
      rendererEligibility: "maplibre" as const,
      modelUse: "demo_only" as const,
    })),
    evidenceProfiles: {
      recommendation: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 60,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      activityPotential: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      movement: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      generalOts: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      targetOts: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      reach: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      influence: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 65, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      serviceability: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 65, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
    },
  });
}

const outputPath = resolve("src/demo/lagos-v1/bundle.json");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    canonicalJson(buildDemoBundle()) + "\n",
    "utf8",
  );
}
