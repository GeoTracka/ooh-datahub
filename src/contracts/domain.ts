import { z } from "zod";

export const SectorSchema = z.enum(["fmcg", "real_estate", "bank_fintech"]);
export const ObjectiveSchema = z.enum(["broad_reach", "influential_core", "near_conversion"]);
export const DaypartSchema = z.enum(["all_day", "am", "midday", "pm", "evening"]);
export const EvidenceGradeSchema = z.enum(["A", "B", "C", "D", "unavailable"]);
export const ProvenanceStateSchema = z.enum(["observed", "modelled", "assumed", "unavailable"]);
export const ApplicabilitySchema = z.enum(["inside", "outside", "unknown"]);

export type Sector = z.infer<typeof SectorSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type Daypart = z.infer<typeof DaypartSchema>;
export type EvidenceGrade = z.infer<typeof EvidenceGradeSchema>;
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;
export type Applicability = z.infer<typeof ApplicabilitySchema>;

export type Brief = {
  productName: string;
  productDescription: string;
  targetAudience: string;
  sector: Sector;
  objective: Objective;
  daypart: Daypart;
  budgetNgn: number;
  normalizationBudgetNgn: number;
  flightStart: string;
  flightEnd: string;
};

export type PillarScores = {
  A: number;
  D: number;
  C: number;
  P: number;
  E: number;
};

export type PlanMode = "planning_fit" | "context_shortlist";

export type PlanContextRevision = {
  mode: "context_shortlist";
  decisionUse: "context_only";
  selectedRowIds: string[];
  selectedRows: Array<{
    rowId: string;
    assetId: string;
    supplier: string | null;
    address: string | null;
    format: string | null;
    rateNgn: number | null;
    orientation?: string | null;
    coordinate: {
      value: [number, number];
      provider: "customer" | "google" | "mapbox";
      accuracy: string;
      license: string;
      sourceArtifactId: string;
    } | null;
  }>;
  enrichmentSnapshotId: string;
  dataRevision: string;
  fingerprint: string;
  claimResolution: import("@/planning/claimLadder").ClaimResolution;
  planningFit: null;
};

export type PackageCandidate = {
  id: string;
  siteIds: string[];
  zoneIds: string[];
  costNgn: number;
  pillars: PillarScores | null;
  planningFit: number | null;
  deliveryRaw: number | null;
  evidenceScore: number;
  evidenceGrade: EvidenceGrade;
  valid: boolean;
  invalidReasonCodes: string[];
  mode: PlanMode;
  contextReason: string | null;
  contextRankScore: number | null;
  estimateFingerprint: string | null;
};

export type PlanningResult = {
  brief: Brief;
  recommended: PackageCandidate;
  internalReplacements: PackageCandidate[];
  selectedZoneIds: string[];
  measurement: import("@/contracts/metrics").EstimatePackageResult | null;
  objectiveDelivery: import("@/planning/objectiveDelivery").ObjectiveDelivery;
  replay: import("@/contracts/metrics").ReplayEnvelope | null;
  planFingerprint: string;
  dataRevision: string;
  contextRevision: PlanContextRevision | null;
};
