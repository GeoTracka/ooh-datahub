export const VECTOR_CONTEXT_DEFAULT_RADII_M = [250, 500, 1000] as const;
export const VECTOR_CONTEXT_MAX_RADIUS_M = 5000;
export const VECTOR_CONTEXT_MAX_RADII = 6;
export const VECTOR_CONTEXT_HIGH_CONFIDENCE_THRESHOLD = 0.7;

export const VECTOR_CONTEXT_DESTINATION_SEMANTICS =
  "destination_presence_context_not_visitation" as const;
export const VECTOR_CONTEXT_NETWORK_SEMANTICS =
  "network_prominence_context_not_observed_traffic" as const;
export const VECTOR_CONTEXT_COVERAGE_SEMANTICS =
  "source_reduction_coverage_not_feature_absence" as const;

export function normalizeVectorContextRadii(values: readonly number[]): number[] {
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new Error("VECTOR_CONTEXT_RADII_REQUIRED");
  if (unique.length > VECTOR_CONTEXT_MAX_RADII) throw new Error("VECTOR_CONTEXT_TOO_MANY_RADII");
  for (const value of unique) {
    if (!Number.isInteger(value) || value <= 0 || value > VECTOR_CONTEXT_MAX_RADIUS_M) {
      throw new Error(`VECTOR_CONTEXT_RADIUS_INVALID:${value}`);
    }
  }
  return unique.sort((a, b) => a - b);
}

export function isMajorRoadClass(value: string): boolean {
  return value === "motorway" || value === "trunk" || value === "primary" || value === "secondary";
}

export function shannonEntropy(counts: readonly number[]): number | null {
  const usable = counts.filter((value) => Number.isFinite(value) && value > 0);
  const total = usable.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  return -usable.reduce((sum, value) => {
    const probability = value / total;
    return sum + probability * Math.log(probability);
  }, 0);
}
