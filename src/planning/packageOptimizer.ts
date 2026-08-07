import type { FrozenBundle } from "@/bundle/bundleSchema";
import type {
  Brief,
  PackageCandidate,
  PillarScores,
  PlanningResult,
} from "@/contracts/domain";
import { estimatePackage } from "@/planning/engine";
import { evaluateEvidence } from "@/planning/evidence";
import { siteDeliveryCompatible } from "@/planning/movement";
import { resolveObjectiveDelivery } from "@/planning/objectiveDelivery";
import { percentileRank, planningFit } from "@/planning/planningFit";

function combinations<T>(items: T[], minimum: number, maximum: number): T[][] {
  const output: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length >= minimum) output.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = start; index < items.length; index += 1) {
      selected.push(items[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return output;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function canonicalPackageId(siteIds: string[]): string {
  return [...siteIds].sort().join("|");
}

export function comparePackageCandidates(
  left: PackageCandidate,
  right: PackageCandidate,
): number {
  return (left.mode === right.mode ? 0 : left.mode === "planning_fit" ? -1 : 1) ||
    ((right.planningFit ?? -1) - (left.planningFit ?? -1)) ||
    ((right.contextRankScore ?? -1) - (left.contextRankScore ?? -1)) ||
    (right.evidenceScore - left.evidenceScore) ||
    (left.costNgn - right.costNgn) ||
    left.id.localeCompare(right.id);
}

function contextRankScore(
  sites: FrozenBundle["sites"],
  sector: Brief["sector"],
): number {
  const scores = sites.map((site) => site.planningScoresBySector[sector]);
  return mean(scores.flatMap((score) => [score.A, score.C, score.P, score.E]));
}

export function optimizePackage(
  bundle: FrozenBundle,
  brief: Brief,
  selectedSiteIds?: string[],
): PlanningResult {
  const allNormalizationSets = combinations(
    bundle.sites,
    3,
    6,
  ).filter((sites) => {
    const zones = new Set(sites.map((site) => site.zoneId));
    const cost = sites.reduce((sum, site) => sum + site.rateNgn, 0);
    return zones.size === 3 && cost <= brief.normalizationBudgetNgn;
  });
  const flightCompatibleSets = allNormalizationSets.filter((sites) =>
    sites.every((site) => siteDeliveryCompatible(
      site,
      brief.flightStart,
      brief.flightEnd,
    )),
  );
  // A fully unavailable bundle still returns the best deterministic repair
  // candidate, which carries typed invalid reasons instead of throwing.
  const siteSets = flightCompatibleSets.length > 0
    ? flightCompatibleSets
    : allNormalizationSets;

  const recommendationEvidence = evaluateEvidence(bundle.evidenceProfiles.recommendation);

  function evaluate(sites: FrozenBundle["sites"]) {
    const measurement = estimatePackage(bundle, {
      sector: brief.sector,
      daypart: brief.daypart,
      siteIds: sites.map((site) => site.id),
      flightStart: brief.flightStart,
      flightEnd: brief.flightEnd,
    });
    const delivery = resolveObjectiveDelivery(bundle, brief, measurement);
    return {
      sites,
      measurement,
      objectiveDelivery: delivery,
      deliveryRaw: delivery.value,
      deliveryReason: delivery.reasonCode,
    };
  }

  const evaluated = siteSets.map(evaluate);
  const deliveryCohort = evaluated.flatMap((item) =>
    item.deliveryRaw === null ? [] : [item.deliveryRaw],
  );

  function toCandidate(item: ReturnType<typeof evaluate>): PackageCandidate {
    const sectorScores = item.sites.map(
      (site) => site.planningScoresBySector[brief.sector],
    );
    const siteIds = item.sites.map((site) => site.id).sort();
    const zoneIds = [...new Set(item.sites.map((site) => site.zoneId))].sort();
    const costNgn = item.sites.reduce((sum, site) => sum + site.rateNgn, 0);
    const invalidReasonCodes = [
      ...(new Set(siteIds).size !== siteIds.length ? ["DUPLICATE_SITE"] : []),
      ...(siteIds.length < 3 || siteIds.length > 6 ? ["SITE_COUNT_OUTSIDE_3_TO_6"] : []),
      ...(zoneIds.length !== 3 ? ["EXACTLY_THREE_ZONES_REQUIRED"] : []),
      ...(costNgn > brief.budgetNgn ? ["BUDGET_EXCEEDED"] : []),
      ...(costNgn > brief.normalizationBudgetNgn
        ? ["NORMALIZATION_ENVELOPE_EXCEEDED"]
        : []),
      ...(item.sites.some((site) => !site.available) ? ["SITE_UNAVAILABLE"] : []),
      ...(item.sites.some((site) => !siteDeliveryCompatible(
        site,
        brief.flightStart,
        brief.flightEnd,
      )) ? ["SITE_UNAVAILABLE_FOR_FLIGHT"] : []),
    ];
    const pillars: PillarScores | null =
      item.deliveryRaw === null || recommendationEvidence.grade === "unavailable"
      ? null
      : {
          A: mean(sectorScores.map((score) => score.A)),
          D: percentileRank(item.deliveryRaw, deliveryCohort),
          C: mean(sectorScores.map((score) => score.C)),
          P: mean(sectorScores.map((score) => score.P)),
          E: mean(sectorScores.map((score) => score.E)),
        };
    return {
      id: canonicalPackageId(siteIds),
      siteIds,
      zoneIds,
      costNgn,
      pillars,
      planningFit: pillars ? planningFit(pillars, brief.objective) : null,
      deliveryRaw: item.deliveryRaw,
      evidenceScore: recommendationEvidence.score,
      evidenceGrade: recommendationEvidence.grade,
      valid: invalidReasonCodes.length === 0,
      invalidReasonCodes,
      mode: pillars ? "planning_fit" : "context_shortlist",
      contextReason: item.deliveryReason ?? (
        recommendationEvidence.grade === "unavailable"
          ? "RECOMMENDATION_EVIDENCE_UNAVAILABLE"
          : null
      ),
      contextRankScore: pillars ? null : contextRankScore(item.sites, brief.sector),
      estimateFingerprint: item.measurement.fingerprint,
    };
  }

  const candidates = evaluated.map(toCandidate);

  const validRanked = candidates
    .filter((candidate) => candidate.valid)
    .sort(comparePackageCandidates);
  const recoveryRanked = candidates
    .filter((candidate) => !candidate.valid)
    .sort((left, right) =>
      (left.invalidReasonCodes.length - right.invalidReasonCodes.length) ||
      (Math.max(0, left.costNgn - brief.budgetNgn) -
        Math.max(0, right.costNgn - brief.budgetNgn)) ||
      comparePackageCandidates(left, right),
    );
  const ranked = [...validRanked, ...recoveryRanked];
  if (ranked.length === 0) {
    throw new Error("BUNDLE_HAS_NO_THREE_ZONE_NORMALIZATION_CANDIDATE");
  }

  let chosenEvaluation = evaluated.find(
    (item) => canonicalPackageId(item.sites.map((site) => site.id)) === ranked[0].id,
  )!;
  let recommended = ranked[0];
  if (selectedSiteIds) {
    const selectedSites = selectedSiteIds.map((siteId) => {
      const site = bundle.sites.find((candidate) => candidate.id === siteId);
      if (!site) throw new Error("UNKNOWN_SITE_OVERRIDE:" + siteId);
      return site;
    });
    chosenEvaluation = evaluate(selectedSites);
    recommended = toCandidate(chosenEvaluation);
  }

  return {
    brief,
    recommended,
    internalReplacements: ranked
      .filter((candidate) => candidate.id !== recommended.id)
      .slice(0, 2),
    selectedZoneIds: recommended.zoneIds,
    measurement: chosenEvaluation.measurement,
    objectiveDelivery: chosenEvaluation.objectiveDelivery,
    replay: chosenEvaluation.measurement.replay,
    planFingerprint: chosenEvaluation.measurement.fingerprint,
    dataRevision: chosenEvaluation.measurement.replay.dataRevision,
    contextRevision: null,
  };
}
