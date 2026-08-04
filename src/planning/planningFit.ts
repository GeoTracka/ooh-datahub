import type { Objective, PillarScores } from "@/contracts/domain";

export const objectiveWeights: Record<Objective, PillarScores> = {
  broad_reach: { A: 20, D: 35, C: 15, P: 20, E: 10 },
  influential_core: { A: 25, D: 35, C: 20, P: 10, E: 10 },
  near_conversion: { A: 25, D: 15, C: 35, P: 10, E: 15 },
};

export function percentileRank(value: number, cohort: number[]): number {
  if (cohort.length === 0) throw new Error("EMPTY_NORMALIZATION_COHORT");
  const below = cohort.filter((candidate) => candidate < value).length;
  const equal = cohort.filter((candidate) => candidate === value).length;
  return 100 * (below + 0.5 * equal) / cohort.length;
}

export function percentileRanks(values: number[]): number[] {
  return values.map((value) => percentileRank(value, values));
}

export function planningFit(scores: PillarScores, objective: Objective): number {
  const weights = objectiveWeights[objective];
  return (
    weights.A * scores.A +
    weights.D * scores.D +
    weights.C * scores.C +
    weights.P * scores.P +
    weights.E * scores.E
  ) / 100;
}
