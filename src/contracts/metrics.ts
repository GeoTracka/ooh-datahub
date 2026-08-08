import { z } from "zod";
import {
  ApplicabilitySchema,
  EvidenceGradeSchema,
  ProvenanceStateSchema,
  type EvidenceGrade,
} from "@/contracts/domain";

const CommonClaimSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  state: ProvenanceStateSchema,
  evidence: EvidenceGradeSchema,
  sourceIds: z.array(z.string().min(1)),
  caveats: z.array(z.string()),
  applicability: ApplicabilitySchema,
});

const ScenarioRangeSchema = z.object({
  type: z.literal("scenario"),
  low: z.number().nonnegative(),
  base: z.number().nonnegative(),
  high: z.number().nonnegative(),
}).refine((value) => value.low <= value.base && value.base <= value.high, {
  message: "Scenario range must be ordered Low ≤ Base ≤ High",
});

const QuantileRangeSchema = z.object({
  type: z.literal("quantile"),
  p10: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p90: z.number().nonnegative(),
}).refine((value) => value.p10 <= value.p50 && value.p50 <= value.p90, {
  message: "Quantiles must be ordered P10 ≤ P50 ≤ P90",
});

export const MetricClaimSchema = z.discriminatedUnion("kind", [
  CommonClaimSchema.extend({
    kind: z.literal("activity_potential"),
    unit: z.literal("index_0_100"),
    value: z.number().min(0).max(100),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("movement"),
    unit: z.enum(["vehicle_passages", "person_passages"]),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("general_ots"),
    unit: z.literal("ots"),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("target_ots"),
    unit: z.literal("ots"),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("scenario_target_reach"),
    state: z.literal("assumed"),
    evidence: z.literal("D"),
    unit: z.literal("people"),
    universe: z.number().positive(),
    range: ScenarioRangeSchema,
  }),
  CommonClaimSchema.extend({
    kind: z.literal("calibrated_target_reach"),
    state: z.literal("modelled"),
    unit: z.literal("people"),
    universe: z.number().positive(),
    range: QuantileRangeSchema,
  }),
  CommonClaimSchema.extend({
    kind: z.literal("influence_capture"),
    unit: z.literal("percent"),
    qiSourceId: z.string().min(1),
    range: z.union([ScenarioRangeSchema, QuantileRangeSchema]),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("influence_weighted_coverage"),
    unit: z.literal("percent"),
    weightSourceId: z.string().min(1),
    range: z.union([ScenarioRangeSchema, QuantileRangeSchema]),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("unavailable"),
    state: z.literal("unavailable"),
    evidence: z.literal("unavailable"),
    unit: z.literal("none"),
    reasonCode: z.string().min(1),
  }),
]).superRefine((claim, context) => {
  if (
    (claim.kind === "scenario_target_reach" && claim.range.high > claim.universe) ||
    (claim.kind === "calibrated_target_reach" && claim.range.p90 > claim.universe)
  ) {
    context.addIssue({ code: "custom", message: "Reach cannot exceed its universe" });
  }
  if (claim.kind === "influence_capture" || claim.kind === "influence_weighted_coverage") {
    const values = claim.range.type === "scenario"
      ? [claim.range.low, claim.range.base, claim.range.high]
      : [claim.range.p10, claim.range.p50, claim.range.p90];
    if (values.some((value) => value > 100)) {
      context.addIssue({ code: "custom", message: "Percentage range cannot exceed 100" });
    }
    if (claim.range.type === "scenario" && (claim.state !== "assumed" || claim.evidence !== "D")) {
      context.addIssue({ code: "custom", message: "Scenario influence must be Assumed Evidence D" });
    }
    if (claim.range.type === "quantile" && claim.state !== "modelled") {
      context.addIssue({ code: "custom", message: "Quantile influence must be modelled" });
    }
  }
});

export type MetricClaim = z.infer<typeof MetricClaimSchema>;

export type PanelFailureCode =
  | "SCALING_OUTSIDE_ENVELOPE"
  | "MEMBER_RATE_OUTSIDE_ENVELOPE"
  | "FREQUENCY_OUTSIDE_ENVELOPE";

export type ScenarioMeasurement = {
  id: "low" | "base" | "high";
  reach: number | null;
  targetOts: number | null;
  influenceCapture: number | null;
  influenceMass: number | null;
  serviceableReach: number | null;
  averageFrequency: number | null;
  failureCode: PanelFailureCode | null;
};

export type MetricEvidence = {
  score: number;
  grade: EvidenceGrade;
  sourceIds: string[];
};

export type MeasurementStage = {
  id: "location" | "places" | "movement" | "ots" | "target" | "unique";
  state: z.infer<typeof ProvenanceStateSchema>;
  valueText: string;
  sourceLabel: string;
  freshnessLabel: string;
  transformation: string;
  nextMapping: string;
  caveats: string[];
  recoveryAction: string | null;
};

export type ReplayEnvelope = {
  bundleId: string;
  bundleSchemaVersion: string;
  modelVersion: string;
  featureSnapshotId: string;
  featureSchemaCompatibilityId: string;
  exposureGeometryVersion: string;
  evidenceProfileVersion: string;
  scheduleModelVersion: string;
  influenceLinkageAssumptionId: string;
  influenceSensitivityId: string;
  sourceManifestIds: string[];
  enrichmentSnapshotId: string | null;
  dataRevision: string;
  exposurePlanFingerprint: string;
  comparabilityKey: string;
  overlapMethodId: string;
  replicateSetId: string;
  seed: number;
  controls: {
    sector: string;
    daypart: string;
    flightStart: string;
    flightEnd: string;
    flightDays: number;
    scheduleBlocks: Array<{
      date: string;
      daypart: "am" | "midday" | "pm" | "evening";
      startMinute: number;
      endMinute: number;
      durationHours: number;
    }>;
    siteIds: string[];
    exposureThreshold: "1+";
  };
};

export type EstimatePackageResult = {
  claim: MetricClaim;
  influence: MetricClaim | null;
  evidence: {
    permittedClaim: MetricEvidence;
    uniqueReach: MetricEvidence | null;
    influence: MetricEvidence | null;
    serviceability: MetricEvidence | null;
  };
  availability: {
    influence: { reasonCode: string | null; recoveryAction: string | null };
    serviceability: { reasonCode: string | null; recoveryAction: string | null };
  };
  scenarios: ScenarioMeasurement[];
  stages: MeasurementStage[];
  fingerprint: string;
  comparabilityKey: string;
  replay: ReplayEnvelope;
};
