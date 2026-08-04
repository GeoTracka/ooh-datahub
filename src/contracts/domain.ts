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
