export type PlanningPillar = "A" | "D" | "C" | "P" | "E";
export type FeatureUse = {
  id: string;
  role: "measurement" | "score";
  pillar: PlanningPillar | null;
};

export function verifyFeatureRegistry(entries: FeatureUse[]): void {
  const uses = new Map<string, FeatureUse[]>();
  for (const entry of entries) {
    const current = uses.get(entry.id) ?? [];
    current.push(entry);
    uses.set(entry.id, current);
  }
  for (const [featureId, featureUses] of uses) {
    const scoredPillars = new Set(
      featureUses.filter((item) => item.role === "score").map((item) => item.pillar),
    );
    const isMeasurement = featureUses.some((item) => item.role === "measurement");
    if (scoredPillars.size > 1 || (isMeasurement && scoredPillars.size > 0)) {
      throw new Error("Feature used more than once: " + featureId);
    }
  }
}
