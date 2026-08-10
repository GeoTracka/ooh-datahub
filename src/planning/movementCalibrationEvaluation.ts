import { z } from "zod";
import type { MovementCalibrationReport } from "@/planning/calibrationGate";
import { canonicalJson } from "@/shared/canonicalJson";

export const MOVEMENT_CALIBRATION_EVALUATION_VERSION = "movement-calibration-evaluation-v1" as const;
export const MOVEMENT_CALIBRATION_PROTOCOL_VERSION = "movement-calibration-protocol-v1" as const;

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DaypartSchema = z.enum(["AM", "Midday", "PM", "Evening"]);
const StratumDimensionSchema = z.enum(["road_class", "daypart"]);
const AllowedEvidenceProtocols = new Set(["https:", "file:", "s3:", "gs:", "az:"]);

function governedUri(value: string): boolean {
  try {
    const uri = new URL(value);
    return AllowedEvidenceProtocols.has(uri.protocol) && !uri.username && !uri.password;
  } catch {
    return false;
  }
}

export const MovementCalibrationProtocolSchema = z.object({
  protocolVersion: z.literal(MOVEMENT_CALIBRATION_PROTOCOL_VERSION),
  protocolId: z.string().min(1),
  frozenAt: z.string().min(1),
  retainedUri: z.string().min(1).refine(governedUri, "retainedUri must be a governed evidence URI"),
  lowCountHandling: z.literal("none"),
  denominatorPolicy: z.literal("all_included_held_out_blocks"),
  stratumMinBlocks: z.literal(8),
  excludedRecords: z.array(z.object({
    recordId: z.string().min(1),
    reason: z.string().min(1),
    preregistrationRef: z.string().min(1),
  }).strict()).default([]),
  excludedStrata: z.array(z.object({
    dimension: StratumDimensionSchema,
    value: z.string().min(1),
    reason: z.string().min(1),
    applicabilityExclusionRef: z.string().min(1),
  }).strict()).default([]),
}).strict();

export const MovementCalibrationRecordSchema = z.object({
  recordId: z.string().min(1),
  locationId: z.string().min(1),
  faceId: z.string().min(1),
  countDirection: z.string().min(1),
  observationDate: DateSchema,
  dayType: z.enum(["weekday", "weekend"]),
  daypart: DaypartSchema,
  roadClass: z.string().min(1),
  split: z.enum(["training", "held_out"]),
  phase: z.enum(["primary", "independent_date"]),
  observed: z.number().finite().nonnegative(),
  predictedP50: z.number().finite().nonnegative().optional(),
  predictedP10: z.number().finite().nonnegative().optional(),
  predictedP90: z.number().finite().nonnegative().optional(),
}).strict().superRefine((record, ctx) => {
  if (record.split === "held_out") {
    if (record.predictedP50 === undefined) {
      ctx.addIssue({ code: "custom", message: "held-out record requires predictedP50", path: ["predictedP50"] });
    }
    if (record.predictedP10 === undefined) {
      ctx.addIssue({ code: "custom", message: "held-out record requires predictedP10", path: ["predictedP10"] });
    }
    if (record.predictedP90 === undefined) {
      ctx.addIssue({ code: "custom", message: "held-out record requires predictedP90", path: ["predictedP90"] });
    }
  }
  if (record.predictedP10 !== undefined && record.predictedP50 !== undefined && record.predictedP10 > record.predictedP50) {
    ctx.addIssue({ code: "custom", message: "predictedP10 must be <= predictedP50", path: ["predictedP10"] });
  }
  if (record.predictedP50 !== undefined && record.predictedP90 !== undefined && record.predictedP50 > record.predictedP90) {
    ctx.addIssue({ code: "custom", message: "predictedP50 must be <= predictedP90", path: ["predictedP50"] });
  }
});

export const MovementCalibrationEvaluationFileSchema = z.object({
  evaluationVersion: z.literal(MOVEMENT_CALIBRATION_EVALUATION_VERSION),
  protocol: MovementCalibrationProtocolSchema,
  records: z.array(MovementCalibrationRecordSchema).min(1),
}).strict();

export type MovementCalibrationProtocol = z.infer<typeof MovementCalibrationProtocolSchema>;
export type MovementCalibrationRecord = z.infer<typeof MovementCalibrationRecordSchema>;
export type MovementCalibrationEvaluationFile = z.infer<typeof MovementCalibrationEvaluationFileSchema>;

export type MovementEvaluationFailure =
  | "INVALID_EVALUATION_FILE"
  | "PROTOCOL_MISMATCH"
  | "INVALID_PROTOCOL_FREEZE_TIME"
  | "INVALID_OBSERVATION_DATE"
  | "PROTOCOL_NOT_PREREGISTERED"
  | "DUPLICATE_RECORD_ID"
  | "UNKNOWN_EXCLUDED_RECORD"
  | "UNKNOWN_EXCLUDED_STRATUM"
  | "ARTIFACT_ROLE_MISMATCH"
  | "LOCATION_SPLIT_LEAKAGE"
  | "NO_INCLUDED_HELD_OUT_BLOCKS"
  | "NO_POSITIVE_HELD_OUT_OBSERVATIONS"
  | "ZERO_HELD_OUT_DENOMINATOR"
  | "ZERO_TOTAL_ELIGIBLE_STRATUM"
  | "NO_ELIGIBLE_BIAS_STRATUM"
  | "INDEPENDENT_DATE_PRE_FREEZE"
  | "INDEPENDENT_DATE_CELL_MISSING"
  | "DECLARED_REPORT_MISMATCH";

export type MovementEvaluationArtifactInput = {
  usage: "training" | "held_out_validation" | "independent_date_replication";
  value: unknown;
};

export type DerivedMovementCalibration = {
  evaluationVersion: typeof MOVEMENT_CALIBRATION_EVALUATION_VERSION;
  evaluationCanonical: string | null;
  report: MovementCalibrationReport | null;
  failures: MovementEvaluationFailure[];
};

function parseDay(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return Number.NaN;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : Number.NaN;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[midpoint]!
    : (sorted[midpoint - 1]! + sorted[midpoint]!) / 2;
}

function cellKey(record: MovementCalibrationRecord): string {
  return [
    record.locationId,
    record.faceId,
    record.dayType,
    record.daypart,
    record.countDirection,
    record.split,
  ].join("\u001f");
}

function stratumKey(dimension: "road_class" | "daypart", value: string): string {
  return `${dimension}\u001f${value}`;
}

function reportsMatch(left: MovementCalibrationReport, right: MovementCalibrationReport): boolean {
  const numericKeys = [
    "heldOutLocations",
    "directionalBlocks",
    "mdape",
    "wape",
    "intervalCoverage",
    "absoluteSignedWape",
    "worstEligibleStratumAbsoluteSignedWape",
  ] as const;
  for (const key of numericKeys) {
    const scale = Math.max(1, Math.abs(left[key]), Math.abs(right[key]));
    if (Math.abs(left[key] - right[key]) > Number.EPSILON * 16 * scale) return false;
  }
  return left.independentDateReplication === right.independentDateReplication
    && left.claimInputsComplete === right.claimInputsComplete
    && left.insideApplicabilityEnvelope === right.insideApplicabilityEnvelope
    && left.downstreamProtocolRegistered === right.downstreamProtocolRegistered;
}

export function deriveMovementCalibrationReport(input: {
  modelFrozenAt: string;
  artifacts: readonly MovementEvaluationArtifactInput[];
  governance: Pick<MovementCalibrationReport,
    "claimInputsComplete" | "insideApplicabilityEnvelope" | "downstreamProtocolRegistered">;
  declaredReport?: MovementCalibrationReport;
}): DerivedMovementCalibration {
  const failures: MovementEvaluationFailure[] = [];
  const parsedArtifacts: Array<{
    usage: MovementEvaluationArtifactInput["usage"];
    file: MovementCalibrationEvaluationFile;
  }> = [];

  for (const artifact of input.artifacts) {
    const parsed = MovementCalibrationEvaluationFileSchema.safeParse(artifact.value);
    if (!parsed.success) {
      failures.push("INVALID_EVALUATION_FILE");
      continue;
    }
    parsedArtifacts.push({ usage: artifact.usage, file: parsed.data });
  }
  if (parsedArtifacts.length !== input.artifacts.length || parsedArtifacts.length === 0) {
    return {
      evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION,
      evaluationCanonical: null,
      report: null,
      failures: [...new Set(failures)],
    };
  }

  const protocolCanonical = canonicalJson(parsedArtifacts[0]!.file.protocol);
  if (parsedArtifacts.some((artifact) => canonicalJson(artifact.file.protocol) !== protocolCanonical)) {
    failures.push("PROTOCOL_MISMATCH");
  }
  const protocol = parsedArtifacts[0]!.file.protocol;
  const protocolFrozenMs = Date.parse(protocol.frozenAt);
  if (!Number.isFinite(protocolFrozenMs)) failures.push("INVALID_PROTOCOL_FREEZE_TIME");

  const modelFrozenMs = Date.parse(input.modelFrozenAt);
  const records = parsedArtifacts.flatMap(({ usage, file }) => file.records.map((record) => ({ usage, record })));
  const recordDays = records.map(({ record }) => parseDay(record.observationDate));
  if (recordDays.some((day) => !Number.isFinite(day))) failures.push("INVALID_OBSERVATION_DATE");
  if (Number.isFinite(protocolFrozenMs) && recordDays.some((day) => Number.isFinite(day) && protocolFrozenMs >= day)) {
    failures.push("PROTOCOL_NOT_PREREGISTERED");
  }

  const recordIds = new Set<string>();
  for (const { record } of records) {
    if (recordIds.has(record.recordId)) failures.push("DUPLICATE_RECORD_ID");
    recordIds.add(record.recordId);
  }
  for (const excluded of protocol.excludedRecords) {
    if (!recordIds.has(excluded.recordId)) failures.push("UNKNOWN_EXCLUDED_RECORD");
  }

  for (const { usage, record } of records) {
    const valid = usage === "training"
      ? record.split === "training" && record.phase === "primary"
      : usage === "held_out_validation"
        ? record.split === "held_out" && record.phase === "primary"
        : record.phase === "independent_date";
    if (!valid) failures.push("ARTIFACT_ROLE_MISMATCH");
  }

  const splitsByLocation = new Map<string, Set<MovementCalibrationRecord["split"]>>();
  for (const { record } of records) {
    const splits = splitsByLocation.get(record.locationId) ?? new Set<MovementCalibrationRecord["split"]>();
    splits.add(record.split);
    splitsByLocation.set(record.locationId, splits);
  }
  if ([...splitsByLocation.values()].some((splits) => splits.size > 1)) {
    failures.push("LOCATION_SPLIT_LEAKAGE");
  }

  const excludedRecordIds = new Set(protocol.excludedRecords.map((entry) => entry.recordId));
  const included = records.filter(({ record }) => !excludedRecordIds.has(record.recordId));
  const heldOut = included.map(({ record }) => record).filter((record) => record.split === "held_out");
  if (heldOut.length === 0) failures.push("NO_INCLUDED_HELD_OUT_BLOCKS");

  const positiveHeldOut = heldOut.filter((record) => record.observed > 0);
  if (positiveHeldOut.length === 0) failures.push("NO_POSITIVE_HELD_OUT_OBSERVATIONS");
  const denominator = heldOut.reduce((sum, record) => sum + record.observed, 0);
  if (denominator <= 0) failures.push("ZERO_HELD_OUT_DENOMINATOR");

  const availableStrata = new Set<string>();
  for (const record of heldOut) {
    availableStrata.add(stratumKey("road_class", record.roadClass));
    availableStrata.add(stratumKey("daypart", record.daypart));
  }
  for (const excluded of protocol.excludedStrata) {
    if (!availableStrata.has(stratumKey(excluded.dimension, excluded.value))) {
      failures.push("UNKNOWN_EXCLUDED_STRATUM");
    }
  }

  const excludedStrata = new Set(protocol.excludedStrata.map((entry) => stratumKey(entry.dimension, entry.value)));
  const eligibleStratumBiases: number[] = [];
  let zeroTotalStratum = false;
  for (const dimension of ["road_class", "daypart"] as const) {
    const values = new Set(heldOut.map((record) => dimension === "road_class" ? record.roadClass : record.daypart));
    for (const value of values) {
      if (excludedStrata.has(stratumKey(dimension, value))) continue;
      const rows = heldOut.filter((record) => (dimension === "road_class" ? record.roadClass : record.daypart) === value);
      if (rows.length < protocol.stratumMinBlocks) continue;
      const observedTotal = rows.reduce((sum, row) => sum + row.observed, 0);
      if (observedTotal <= 0) {
        zeroTotalStratum = true;
        continue;
      }
      const signedError = rows.reduce((sum, row) => sum + (row.predictedP50! - row.observed), 0);
      eligibleStratumBiases.push(Math.abs(signedError / observedTotal));
    }
  }
  if (zeroTotalStratum) failures.push("ZERO_TOTAL_ELIGIBLE_STRATUM");
  if (eligibleStratumBiases.length === 0) failures.push("NO_ELIGIBLE_BIAS_STRATUM");

  const independent = included.map(({ record }) => record).filter((record) => record.phase === "independent_date");
  if (Number.isFinite(modelFrozenMs) && independent.some((record) => parseDay(record.observationDate) <= modelFrozenMs)) {
    failures.push("INDEPENDENT_DATE_PRE_FREEZE");
  }
  const independentDatesByCell = new Map<string, Set<string>>();
  for (const record of independent) {
    if (!Number.isFinite(modelFrozenMs) || parseDay(record.observationDate) <= modelFrozenMs) continue;
    const dates = independentDatesByCell.get(cellKey(record)) ?? new Set<string>();
    dates.add(record.observationDate);
    independentDatesByCell.set(cellKey(record), dates);
  }
  const primary = included.map(({ record }) => record).filter((record) => record.phase === "primary");
  const independentDateReplication = primary.length > 0 && primary.every((record) => {
    const dates = independentDatesByCell.get(cellKey(record));
    return Boolean(dates && [...dates].some((date) => date !== record.observationDate));
  });
  if (!independentDateReplication) failures.push("INDEPENDENT_DATE_CELL_MISSING");

  const evaluationCanonical = canonicalJson({
    evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION,
    protocol,
    records: records
      .map(({ usage, record }) => ({ usage, record }))
      .sort((a, b) => a.record.recordId.localeCompare(b.record.recordId)),
  });

  const fatalFailures = failures.filter((failure) => failure !== "INDEPENDENT_DATE_CELL_MISSING");
  if (fatalFailures.length > 0 || heldOut.length === 0 || positiveHeldOut.length === 0 || denominator <= 0 || eligibleStratumBiases.length === 0) {
    return {
      evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION,
      evaluationCanonical,
      report: null,
      failures: [...new Set(failures)],
    };
  }

  const absoluteErrors = heldOut.map((record) => Math.abs(record.predictedP50! - record.observed));
  const signedError = heldOut.reduce((sum, record) => sum + (record.predictedP50! - record.observed), 0);
  const report: MovementCalibrationReport = {
    heldOutLocations: new Set(heldOut.map((record) => record.locationId)).size,
    directionalBlocks: included.length,
    mdape: median(positiveHeldOut.map((record) => Math.abs(record.predictedP50! - record.observed) / record.observed)),
    wape: absoluteErrors.reduce((sum, error) => sum + error, 0) / denominator,
    intervalCoverage: heldOut.filter((record) => record.observed >= record.predictedP10! && record.observed <= record.predictedP90!).length / heldOut.length,
    absoluteSignedWape: Math.abs(signedError / denominator),
    worstEligibleStratumAbsoluteSignedWape: Math.max(...eligibleStratumBiases),
    independentDateReplication,
    ...input.governance,
  };

  if (input.declaredReport && !reportsMatch(report, input.declaredReport)) {
    failures.push("DECLARED_REPORT_MISMATCH");
  }

  return {
    evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION,
    evaluationCanonical,
    report,
    failures: [...new Set(failures)],
  };
}
