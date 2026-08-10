import { z } from "zod";
import { canonicalJson } from "@/shared/canonicalJson";
import {
  evaluateMovementCalibration,
  type CalibrationFailure,
  type MovementCalibrationReport,
} from "@/planning/calibrationGate";

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
  evidenceEnvironment: z.enum(["production_reviewed", "test_fixture"]),
  modelVersion: z.string().min(1),
  replayVersion: z.string().min(1),
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
  | "ARTIFACT_PERIOD_INVALID"
  | "ARTIFACT_ROLE_COLLISION"
  | "DUPLICATE_ARTIFACT_ID"
  | "MISSING_HELD_OUT_MOVEMENT_TRUTH"
  | "MISSING_HELD_OUT_EXPOSURE_GEOMETRY_TRUTH"
  | "MISSING_HELD_OUT_TARGET_PANEL_TRUTH"
  | "MISSING_DOWNSTREAM_VALIDATION_RESULT"
  | "MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE";

export type CalibrationPromotionFailure = "TEST_FIXTURE_NOT_PROMOTABLE";

export type CalibrationPromotionDecision = {
  policyVersion: typeof CALIBRATION_PROMOTION_POLICY_VERSION;
  packageValid: boolean;
  calibrationPassed: boolean;
  eligibleForEvidenceC: boolean;
  packageFailures: CalibrationPackageFailure[];
  promotionFailures: CalibrationPromotionFailure[];
  calibrationFailures: CalibrationFailure[];
};

function periodValid(start: string, end: string): boolean {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= endMs;
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

  if (pkg.artifacts.some((artifact) => !periodValid(artifact.periodStart, artifact.periodEnd))) {
    failures.push("ARTIFACT_PERIOD_INVALID");
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
  if ([...usagesBySha.values()].some((usages) =>
    usages.has("training") &&
    (usages.has("held_out_validation") || usages.has("independent_date_replication")))) {
    failures.push("ARTIFACT_ROLE_COLLISION");
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
  if (pkg.movementCalibrationReport.independentDateReplication &&
      !hasArtifact(pkg.artifacts, "movement_truth", "independent_date_replication")) {
    failures.push("MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE");
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

export function evaluateCalibrationPromotion(input: unknown): CalibrationPromotionDecision {
  const validation = validateCalibrationEvidencePackage(input);
  if (!validation.package) {
    return {
      policyVersion: CALIBRATION_PROMOTION_POLICY_VERSION,
      packageValid: false,
      calibrationPassed: false,
      eligibleForEvidenceC: false,
      packageFailures: validation.failures,
      promotionFailures: [],
      calibrationFailures: [],
    };
  }

  const report = validation.package.movementCalibrationReport satisfies MovementCalibrationReport;
  const calibration = evaluateMovementCalibration(report);
  const promotionFailures: CalibrationPromotionFailure[] =
    validation.package.evidenceEnvironment === "test_fixture"
      ? ["TEST_FIXTURE_NOT_PROMOTABLE"]
      : [];

  return {
    policyVersion: CALIBRATION_PROMOTION_POLICY_VERSION,
    packageValid: validation.failures.length === 0,
    calibrationPassed: calibration.passed,
    eligibleForEvidenceC:
      validation.failures.length === 0 && promotionFailures.length === 0 && calibration.passed,
    packageFailures: validation.failures,
    promotionFailures,
    calibrationFailures: calibration.failures,
  };
}
