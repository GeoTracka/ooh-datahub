import { z } from "zod";
import { canonicalJson } from "@/shared/canonicalJson";
import {
  MOVEMENT_CALIBRATION_GATE_VERSION,
  evaluateMovementCalibration,
  type CalibrationFailure,
  type MovementCalibrationReport,
} from "@/planning/calibrationGate";
import type { MovementEvaluationFailure } from "@/planning/movementCalibrationEvaluation";

export const CALIBRATION_EVIDENCE_PACKAGE_VERSION = "calibration-evidence-package-v1" as const;
export const CALIBRATION_PROMOTION_POLICY_VERSION = "calibration-promotion-policy-v1" as const;

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const FingerprintSchema = z.string().regex(/^[0-9a-f]{32}$/);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CalibrationEvidenceArtifactSchema = z.object({
  artifactId: z.string().min(1),
  sha256: Sha256Schema,
  kind: z.enum([
    "movement_truth",
    "exposure_geometry_truth",
    "target_panel_truth",
    "downstream_validation_result",
  ]),
  usage: z.enum(["training", "held_out_validation", "independent_date_replication"]),
  provenanceUri: z.string().min(1),
  retainedUri: z.string().min(1),
  licenseId: z.string().min(1),
  rightsReviewRef: z.string().min(1),
  commercialUseStatus: z.literal("permitted"),
  periodStart: DateSchema,
  periodEnd: DateSchema,
}).strict();

export const CalibrationContextBindingSchema = z.object({
  snapshotId: z.string().min(1),
  featureVersion: z.string().min(1),
  resolverVersion: z.string().min(1),
  sourceFingerprint: FingerprintSchema,
  resolutionFingerprint: FingerprintSchema,
}).strict();

export const MovementCalibrationReportSchema = z.object({
  heldOutLocations: z.number().int().nonnegative(),
  directionalBlocks: z.number().int().nonnegative(),
  mdape: z.number().finite().nonnegative(),
  wape: z.number().finite().nonnegative(),
  intervalCoverage: z.number().finite().min(0).max(1),
  absoluteSignedWape: z.number().finite().nonnegative(),
  worstEligibleStratumAbsoluteSignedWape: z.number().finite().nonnegative(),
  independentDateReplication: z.boolean(),
  claimInputsComplete: z.boolean(),
  insideApplicabilityEnvelope: z.boolean(),
  downstreamProtocolRegistered: z.boolean(),
}).strict();

export const CalibrationEvidencePackageSchema = z.object({
  packageVersion: z.literal(CALIBRATION_EVIDENCE_PACKAGE_VERSION),
  movementCalibrationGateVersion: z.literal(MOVEMENT_CALIBRATION_GATE_VERSION),
  evidenceEnvironment: z.enum(["production_reviewed", "test_fixture"]),
  modelVersion: z.string().min(1),
  replayVersion: z.string().min(1),
  modelFrozenAt: z.string().min(1),
  geographyId: z.string().min(1),
  applicabilityScope: z.string().min(1),
  contextBinding: CalibrationContextBindingSchema,
  artifacts: z.array(CalibrationEvidenceArtifactSchema).min(1),
  movementCalibrationReport: MovementCalibrationReportSchema,
}).strict();

export type CalibrationEvidenceArtifact = z.infer<typeof CalibrationEvidenceArtifactSchema>;
export type CalibrationContextBinding = z.infer<typeof CalibrationContextBindingSchema>;
export type CalibrationEvidencePackage = z.infer<typeof CalibrationEvidencePackageSchema>;

export type CalibrationPackageFailure =
  | "INVALID_PACKAGE_SCHEMA"
  | "INVALID_MODEL_FREEZE_TIME"
  | "ARTIFACT_PERIOD_INVALID"
  | "UNREVIEWED_PROVENANCE_OR_RIGHTS"
  | "ARTIFACT_ROLE_COLLISION"
  | "DUPLICATE_ARTIFACT_ID"
  | "MISSING_TRAINING_MOVEMENT_TRUTH"
  | "MISSING_HELD_OUT_MOVEMENT_TRUTH"
  | "MISSING_HELD_OUT_EXPOSURE_GEOMETRY_TRUTH"
  | "MISSING_HELD_OUT_TARGET_PANEL_TRUTH"
  | "MISSING_DOWNSTREAM_VALIDATION_RESULT"
  | "MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE"
  | "INDEPENDENT_DATE_NOT_POST_FREEZE";

export type CalibrationPromotionFailure =
  | "TEST_FIXTURE_NOT_PROMOTABLE"
  | "MOVEMENT_EVALUATION_NOT_VERIFIED"
  | "MOVEMENT_EVALUATION_INVALID";

export type CalibrationPromotionDecision = {
  policyVersion: typeof CALIBRATION_PROMOTION_POLICY_VERSION;
  movementCalibrationGateVersion: typeof MOVEMENT_CALIBRATION_GATE_VERSION;
  packageValid: boolean;
  movementEvaluationVerified: boolean;
  calibrationPassed: boolean;
  eligibleForEvidenceC: boolean;
  packageFailures: CalibrationPackageFailure[];
  promotionFailures: CalibrationPromotionFailure[];
  evaluationFailures: MovementEvaluationFailure[];
  calibrationFailures: CalibrationFailure[];
};

const unreviewedMetadata = new Set(["unknown", "n/a", "na", "none", "tbd", "pending"]);
const evidenceUriProtocols = new Set(["https:", "file:", "s3:", "gs:", "az:"]);

function periodValid(start: string, end: string): boolean {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return false;
  return new Date(startMs).toISOString().slice(0, 10) === start
    && new Date(endMs).toISOString().slice(0, 10) === end;
}

function reviewedText(value: string): boolean {
  return !unreviewedMetadata.has(value.trim().toLowerCase());
}

function reviewedUri(value: string): boolean {
  try {
    const url = new URL(value);
    return evidenceUriProtocols.has(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function artifactGovernanceReviewed(artifact: CalibrationEvidenceArtifact): boolean {
  return reviewedUri(artifact.provenanceUri)
    && reviewedUri(artifact.retainedUri)
    && reviewedText(artifact.licenseId)
    && reviewedText(artifact.rightsReviewRef);
}

function hasArtifact(
  artifacts: readonly CalibrationEvidenceArtifact[],
  kind: CalibrationEvidenceArtifact["kind"],
  usage: CalibrationEvidenceArtifact["usage"],
): boolean {
  return artifacts.some((artifact) => artifact.kind === kind && artifact.usage === usage);
}

export function validateCalibrationEvidencePackage(
  input: unknown,
): { package: CalibrationEvidencePackage | null; failures: CalibrationPackageFailure[] } {
  const parsed = CalibrationEvidencePackageSchema.safeParse(input);
  if (!parsed.success) {
    return { package: null, failures: ["INVALID_PACKAGE_SCHEMA"] };
  }

  const pkg = parsed.data;
  const failures: CalibrationPackageFailure[] = [];
  const modelFrozenMs = Date.parse(pkg.modelFrozenAt);

  if (!Number.isFinite(modelFrozenMs)) failures.push("INVALID_MODEL_FREEZE_TIME");
  if (pkg.artifacts.some((artifact) => !periodValid(artifact.periodStart, artifact.periodEnd))) {
    failures.push("ARTIFACT_PERIOD_INVALID");
  }
  if (pkg.artifacts.some((artifact) => !artifactGovernanceReviewed(artifact))) {
    failures.push("UNREVIEWED_PROVENANCE_OR_RIGHTS");
  }

  const artifactIds = new Set<string>();
  for (const artifact of pkg.artifacts) {
    if (artifactIds.has(artifact.artifactId)) {
      failures.push("DUPLICATE_ARTIFACT_ID");
      break;
    }
    artifactIds.add(artifact.artifactId);
  }

  const usagesBySha = new Map<string, Set<CalibrationEvidenceArtifact["usage"]>>();
  for (const artifact of pkg.artifacts) {
    const usages = usagesBySha.get(artifact.sha256) ?? new Set<CalibrationEvidenceArtifact["usage"]>();
    usages.add(artifact.usage);
    usagesBySha.set(artifact.sha256, usages);
  }
  if ([...usagesBySha.values()].some((usages) => usages.size > 1)) {
    failures.push("ARTIFACT_ROLE_COLLISION");
  }

  if (!hasArtifact(pkg.artifacts, "movement_truth", "training")) {
    failures.push("MISSING_TRAINING_MOVEMENT_TRUTH");
  }
  if (!hasArtifact(pkg.artifacts, "movement_truth", "held_out_validation")) {
    failures.push("MISSING_HELD_OUT_MOVEMENT_TRUTH");
  }
  if (!hasArtifact(pkg.artifacts, "exposure_geometry_truth", "held_out_validation")) {
    failures.push("MISSING_HELD_OUT_EXPOSURE_GEOMETRY_TRUTH");
  }
  if (!hasArtifact(pkg.artifacts, "target_panel_truth", "held_out_validation")) {
    failures.push("MISSING_HELD_OUT_TARGET_PANEL_TRUTH");
  }
  if (!hasArtifact(pkg.artifacts, "downstream_validation_result", "held_out_validation")) {
    failures.push("MISSING_DOWNSTREAM_VALIDATION_RESULT");
  }

  const replicationArtifacts = pkg.artifacts.filter((artifact) =>
    artifact.kind === "movement_truth" && artifact.usage === "independent_date_replication");
  if (pkg.movementCalibrationReport.independentDateReplication && replicationArtifacts.length === 0) {
    failures.push("MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE");
  }
  if (Number.isFinite(modelFrozenMs) && replicationArtifacts.some((artifact) =>
    Date.parse(`${artifact.periodStart}T00:00:00Z`) <= modelFrozenMs)) {
    failures.push("INDEPENDENT_DATE_NOT_POST_FREEZE");
  }

  return { package: pkg, failures: [...new Set(failures)] };
}

export function canonicalCalibrationEvidencePackage(pkg: CalibrationEvidencePackage): string {
  return canonicalJson({
    ...pkg,
    artifacts: [...pkg.artifacts].sort((left, right) =>
      left.sha256.localeCompare(right.sha256) ||
      left.kind.localeCompare(right.kind) ||
      left.usage.localeCompare(right.usage) ||
      left.artifactId.localeCompare(right.artifactId)),
  });
}

function decision(input: {
  validation: ReturnType<typeof validateCalibrationEvidencePackage>;
  report: MovementCalibrationReport | null;
  movementEvaluationVerified: boolean;
  evaluationFailures?: MovementEvaluationFailure[];
}): CalibrationPromotionDecision {
  const { validation } = input;
  if (!validation.package) {
    return {
      policyVersion: CALIBRATION_PROMOTION_POLICY_VERSION,
      movementCalibrationGateVersion: MOVEMENT_CALIBRATION_GATE_VERSION,
      packageValid: false,
      movementEvaluationVerified: false,
      calibrationPassed: false,
      eligibleForEvidenceC: false,
      packageFailures: validation.failures,
      promotionFailures: [],
      evaluationFailures: input.evaluationFailures ?? [],
      calibrationFailures: [],
    };
  }

  const calibration = input.report ? evaluateMovementCalibration(input.report) : { passed: false, failures: [] as CalibrationFailure[] };
  const promotionFailures: CalibrationPromotionFailure[] = [];
  if (validation.package.evidenceEnvironment === "test_fixture") {
    promotionFailures.push("TEST_FIXTURE_NOT_PROMOTABLE");
  } else if (!input.movementEvaluationVerified) {
    promotionFailures.push((input.evaluationFailures?.length ?? 0) > 0
      ? "MOVEMENT_EVALUATION_INVALID"
      : "MOVEMENT_EVALUATION_NOT_VERIFIED");
  }

  return {
    policyVersion: CALIBRATION_PROMOTION_POLICY_VERSION,
    movementCalibrationGateVersion: MOVEMENT_CALIBRATION_GATE_VERSION,
    packageValid: validation.failures.length === 0,
    movementEvaluationVerified: input.movementEvaluationVerified,
    calibrationPassed: calibration.passed,
    eligibleForEvidenceC:
      validation.failures.length === 0
      && promotionFailures.length === 0
      && input.movementEvaluationVerified
      && calibration.passed,
    packageFailures: validation.failures,
    promotionFailures,
    evaluationFailures: input.evaluationFailures ?? [],
    calibrationFailures: calibration.failures,
  };
}

export function evaluateCalibrationPromotion(input: unknown): CalibrationPromotionDecision {
  const validation = validateCalibrationEvidencePackage(input);
  return decision({
    validation,
    report: validation.package?.movementCalibrationReport ?? null,
    movementEvaluationVerified: validation.package?.evidenceEnvironment === "test_fixture",
  });
}

export function evaluateVerifiedCalibrationPromotion(input: {
  packageInput: unknown;
  derivedReport: MovementCalibrationReport | null;
  evaluationFailures: MovementEvaluationFailure[];
}): CalibrationPromotionDecision {
  const validation = validateCalibrationEvidencePackage(input.packageInput);
  return decision({
    validation,
    report: input.derivedReport,
    movementEvaluationVerified:
      Boolean(input.derivedReport) && input.evaluationFailures.length === 0,
    evaluationFailures: input.evaluationFailures,
  });
}
