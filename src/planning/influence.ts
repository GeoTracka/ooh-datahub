export function influenceCapturePct(
  reachedInfluenceMass: number,
  influenceUniverse: number,
): number | null {
  if (influenceUniverse <= 0) return null;
  return 100 * reachedInfluenceMass / influenceUniverse;
}
