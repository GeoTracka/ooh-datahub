import type { EvidenceGrade } from "@/contracts/domain";

export type EvidenceComponents = {
  source: number;
  validation: number;
  temporal: number;
  granularityCoverage: number;
  completeness: number;
  minimumCritical: number;
  caps: number[];
  hasZeroCritical: boolean;
};

export function evidenceScore(input: EvidenceComponents): number {
  const raw =
    0.25 * input.source +
    0.25 * input.validation +
    0.20 * input.temporal +
    0.20 * input.granularityCoverage +
    0.10 * input.completeness;
  return Math.min(raw, input.minimumCritical + 15, ...input.caps);
}

export function evidenceGrade(score: number, hasZeroCritical = false): EvidenceGrade {
  if (hasZeroCritical || score < 40) return "unavailable";
  if (score < 55) return "D";
  if (score < 70) return "C";
  if (score < 85) return "B";
  return "A";
}

export function evaluateEvidence(input: EvidenceComponents): {
  score: number;
  grade: EvidenceGrade;
} {
  const score = input.hasZeroCritical ? 0 : evidenceScore(input);
  return { score, grade: evidenceGrade(score, input.hasZeroCritical) };
}
