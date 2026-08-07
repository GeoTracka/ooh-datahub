export function activityPotential(value: number, frozenCohort: number[]): number | null {
  if (frozenCohort.length < 30) return null;
  const ordered = [...frozenCohort].sort((left, right) => left - right);
  const below = ordered.filter((item) => item < value).length;
  const equal = ordered.filter((item) => item === value).length;
  return 100 * (below + 0.5 * equal) / ordered.length;
}
