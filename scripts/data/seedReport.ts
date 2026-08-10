import { z } from "zod";

const SourceCheckSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  driveFileId: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  fileSizeBytes: z.number().int().nonnegative(),
});

const SourceRunSchema = z.object({
  sourceId: z.string().min(1),
  sheets: z.array(z.record(z.string(), z.unknown())),
});

const CountSchema = z.object({
  oohAccepted: z.number().int().nonnegative(),
  oohActive: z.number().int().nonnegative(),
  oohSuperseded: z.number().int().nonnegative(),
  boardQualityAccepted: z.number().int().nonnegative(),
  faanMonthlyAccepted: z.number().int().nonnegative(),
  faanAnnualAccepted: z.number().int().nonnegative(),
  quarantined: z.number().int().nonnegative(),
});

export const SeedReportSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().min(1),
  deterministic: z.literal(true),
  sourceDirectory: z.literal("runtime_argument"),
  sourceChecks: z.array(SourceCheckSchema).min(1),
  sourceRuns: z.array(SourceRunSchema).min(1),
  counts: CountSchema,
  qualityFlagCounts: z.record(z.string(), z.number().int().nonnegative()),
  coverage: z.unknown(),
  outputs: z.object({
    ooh: z.string().min(1),
    boardQuality: z.string().min(1),
    faanMonthly: z.string().min(1),
    faanAnnual: z.string().min(1),
    quarantine: z.string().min(1),
    report: z.string().min(1),
  }),
  plannerBoundary: z.literal("context_staging_only_not_frozen_demo_or_evidence_promotion"),
});

export type SeedReport = z.infer<typeof SeedReportSchema>;
