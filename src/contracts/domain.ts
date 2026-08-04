import { z } from "zod";

export const EvidenceGradeSchema = z.enum(["A", "B", "C", "D", "unavailable"]);
export type EvidenceGrade = z.infer<typeof EvidenceGradeSchema>;

export const ProvenanceStateSchema = z.enum(["assumed", "modelled", "unavailable"]);
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;

export const ApplicabilitySchema = z.enum(["inside", "outside", "partial"]);
export type Applicability = z.infer<typeof ApplicabilitySchema>;
