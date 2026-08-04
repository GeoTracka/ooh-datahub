import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";

export type SiteTargetOts = {
  siteId: string;
  zoneId: string;
  blocks: Array<{
    blockId: string;
    daypart: Exclude<Daypart, "all_day">;
    byCell: Record<string, number>;
  }>;
};

export type PanelResult = {
  reach: number;
  targetOts: number;
  averageFrequency: number | null;
  influenceMass: number;
  influenceUniverse: number;
  serviceableReach: number;
};

export function runStablePanel(
  bundle: FrozenBundle,
  sector: Sector,
  siteInputs: SiteTargetOts[],
  propensityConcentration: number,
): PanelResult {
  let targetOtsTotal = 0;
  let reach = 0;
  let influenceMass = 0;
  let influenceUniverse = 0;
  let serviceableReach = 0;

  const targets = bundle.targets.filter((target) => target.sector === sector);
  for (const target of targets) {
    const members = bundle.panel.filter(
      (member) => member.sector === sector && member.cellId === target.cellId,
    );
    const lambdas = new Map(members.map((member) => [member.id, 0]));

    for (const siteInput of siteInputs) {
      for (const block of siteInput.blocks) {
        const siteTargetOts = block.byCell[target.cellId] ?? 0;
        targetOtsTotal += siteTargetOts;
        const bases = members.map((member) => ({
          member,
          value: Math.pow(
            member.zoneAffinity[siteInput.zoneId] * member.timeAffinity[block.daypart],
            propensityConcentration,
          ),
        }));
        const denominator = bases.reduce(
          (sum, item) => sum + item.member.weight * item.value,
          0,
        );
        if (siteTargetOts > 0 && denominator <= 0) {
          throw new Error("Zero panel propensity denominator");
        }
        const c = denominator === 0 ? 0 : siteTargetOts / denominator;
        if (
          siteTargetOts > 0 &&
          (c < bundle.scalingEnvelope.minimumC || c > bundle.scalingEnvelope.maximumC)
        ) {
          throw new Error("SCALING_OUTSIDE_ENVELOPE");
        }
        for (const item of bases) {
          const lambda = c * item.value;
          if (lambda > bundle.scalingEnvelope.maximumMemberLambda) {
            throw new Error("MEMBER_RATE_OUTSIDE_ENVELOPE");
          }
          lambdas.set(item.member.id, (lambdas.get(item.member.id) ?? 0) + lambda);
        }
      }
    }

    for (const member of members) {
      const probability = 1 - Math.exp(-(lambdas.get(member.id) ?? 0));
      reach += member.weight * probability;
      influenceMass += member.weight * member.qi * probability;
      influenceUniverse += member.weight * member.qi;
      serviceableReach += member.weight * member.serviceability * probability;
    }
  }

  const averageFrequency = reach > 0 ? targetOtsTotal / reach : null;
  if (
    averageFrequency !== null &&
    averageFrequency > bundle.scalingEnvelope.maximumAverageFrequency
  ) {
    throw new Error("FREQUENCY_OUTSIDE_ENVELOPE");
  }
  return {
    reach,
    targetOts: targetOtsTotal,
    averageFrequency,
    influenceMass,
    influenceUniverse,
    serviceableReach,
  };
}
