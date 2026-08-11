import type { FrozenBundle } from "@/bundle/bundleSchema";
import type {
  Brief,
  PackageCandidate,
  PackageOption,
  PackageOptionStyle,
  PillarScores,
  PlanningResult,
} from "@/contracts/domain";
import {
  applyResolvedAudience,
  resolveBriefAudience,
} from "@/planning/briefNormalization";
import { estimatePackage } from "@/planning/engine";
import { evaluateEvidence } from "@/planning/evidence";
import { siteDeliveryCompatible } from "@/planning/movement";
import { resolveObjectiveDelivery } from "@/planning/objectiveDelivery";
import {
  objectiveWeights,
  percentileRank,
  planningFit,
} from "@/planning/planningFit";

const MAX_EXHAUSTIVE_INVENTORY = 18;
const MAX_BOUNDED_ZONES = 8;
const MAX_SITES_PER_BOUNDED_ZONE = 2;
export const MAX_EXACT_CANDIDATES = 512;

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

function cheapSiteScore(
  site: FrozenBundle["sites"][number],
  brief: Brief,
): number {
  const scores = site.planningScoresBySector[brief.sector];
  const weights = objectiveWeights[brief.objective];
  const denominator = weights.A + weights.C + weights.P + weights.E;
  return (
    weights.A * scores.A +
    weights.C * scores.C +
    weights.P * scores.P +
    weights.E * scores.E
  ) / denominator;
}

function boundedCandidateSiteSets(
  bundle: FrozenBundle,
  brief: Brief,
): FrozenBundle["sites"][] {
  const grouped = new Map<string, FrozenBundle["sites"]>();
  for (const site of bundle.sites) {
    if (site.rateNgn > brief.normalizationBudgetNgn) continue;
    const current = grouped.get(site.zoneId) ?? [];
    current.push(site);
    grouped.set(site.zoneId, current);
  }

  const rankedZones = [...grouped.entries()]
    .map(([zoneId, sites]) => {
      const rankedSites = [...sites]
        .sort((left, right) =>
          cheapSiteScore(right, brief) - cheapSiteScore(left, brief) ||
          left.rateNgn - right.rateNgn ||
          left.id.localeCompare(right.id),
        )
        .slice(0, MAX_SITES_PER_BOUNDED_ZONE);
      return {
        zoneId,
        sites: rankedSites,
        score: rankedSites.length === 0
          ? -1
          : mean(rankedSites.map((site) => cheapSiteScore(site, brief))),
      };
    })
    .filter((zone) => zone.sites.length > 0)
    .sort((left, right) =>
      right.score - left.score || left.zoneId.localeCompare(right.zoneId),
    )
    .slice(0, MAX_BOUNDED_ZONES);

  const candidates = new Map<string, {
    sites: FrozenBundle["sites"];
    preliminaryScore: number;
    costNgn: number;
  }>();

  for (const zones of combinations(rankedZones, 3, 3)) {
    const variants = zones.map((zone) => [
      [zone.sites[0]],
      ...(zone.sites.length > 1 ? [[zone.sites[0], zone.sites[1]]] : []),
    ]);
    const visit = (index: number, selected: FrozenBundle["sites"]) => {
      if (index === variants.length) {
        const costNgn = selected.reduce((sum, site) => sum + site.rateNgn, 0);
        if (costNgn > brief.normalizationBudgetNgn) return;
        const id = canonicalPackageId(selected.map((site) => site.id));
        candidates.set(id, {
          sites: [...selected],
          preliminaryScore: mean(selected.map((site) => cheapSiteScore(site, brief))),
          costNgn,
        });
        return;
      }
      for (const variant of variants[index]) {
        visit(index + 1, [...selected, ...variant]);
      }
    };
    visit(0, []);
  }

  return [...candidates.values()]
    .sort((left, right) =>
      right.preliminaryScore - left.preliminaryScore ||
      left.costNgn - right.costNgn ||
      canonicalPackageId(left.sites.map((site) => site.id)).localeCompare(
        canonicalPackageId(right.sites.map((site) => site.id)),
      ),
    )
    .slice(0, MAX_EXACT_CANDIDATES)
    .map((candidate) => candidate.sites);
}

export function candidateSiteSetsForPlanning(
  bundle: FrozenBundle,
  brief: Brief,
): FrozenBundle["sites"][] {
  if (bundle.sites.length > MAX_EXHAUSTIVE_INVENTORY) {
    return boundedCandidateSiteSets(bundle, brief);
  }
  return combinations(bundle.sites, 3, 6).filter((sites) => {
    const zones = new Set(sites.map((site) => site.zoneId));
    const cost = sites.reduce((sum, site) => sum + site.rateNgn, 0);
    return zones.size === 3 && cost <= brief.normalizationBudgetNgn;
  });
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

function candidateScore(candidate: PackageCandidate): number {
  return candidate.planningFit ?? candidate.contextRankScore ?? -1;
}

function pickCandidate(
  candidates: PackageCandidate[],
  selectedIds: Set<string>,
  compare: (left: PackageCandidate, right: PackageCandidate) => number,
  eligible: (candidate: PackageCandidate) => boolean = () => true,
): PackageCandidate | null {
  let selected: PackageCandidate | null = null;
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.id) || !eligible(candidate)) continue;
    if (!selected || compare(candidate, selected) < 0) selected = candidate;
  }
  return selected;
}

export function selectPackageOptions(
  ranked: PackageCandidate[],
): PackageOption[] {
  const valid = ranked.filter((candidate) => candidate.valid);
  if (ranked.length === 0) return [];

  const deliveryComparator = (left: PackageCandidate, right: PackageCandidate) =>
    ((right.deliveryRaw ?? -1) - (left.deliveryRaw ?? -1)) ||
    comparePackageCandidates(left, right);
  const budgetComparator = (left: PackageCandidate, right: PackageCandidate) =>
    left.costNgn - right.costNgn || comparePackageCandidates(left, right);
  const selectedIds = new Set<string>();
  const selected = new Map<PackageOptionStyle, PackageCandidate>();

  const best = pickCandidate(valid, selectedIds, comparePackageCandidates) ??
    pickCandidate(ranked, selectedIds, comparePackageCandidates);
  if (!best) return [];
  selected.set("best_overall", best);
  selectedIds.add(best.id);

  const maximum = pickCandidate(valid, selectedIds, deliveryComparator) ??
    pickCandidate(ranked, selectedIds, deliveryComparator);
  if (maximum) {
    selected.set("maximum_delivery", maximum);
    selectedIds.add(maximum.id);
  }

  const bestScore = candidateScore(best);
  const withinFitGuardrail = (candidate: PackageCandidate) =>
    candidateScore(candidate) >= bestScore - 5;
  const budget = pickCandidate(valid, selectedIds, budgetComparator, withinFitGuardrail) ??
    pickCandidate(ranked, selectedIds, budgetComparator, withinFitGuardrail) ??
    pickCandidate(valid, selectedIds, comparePackageCandidates) ??
    pickCandidate(ranked, selectedIds, comparePackageCandidates);
  if (budget) {
    selected.set("budget_smart", budget);
    selectedIds.add(budget.id);
  }

  return (["best_overall", "maximum_delivery", "budget_smart"] as const)
    .flatMap((style) => {
      const candidate = selected.get(style);
      return candidate ? [{ style, candidate }] : [];
    });
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
  const resolvedAudience = resolveBriefAudience(bundle, brief);
  const planningBundle = applyResolvedAudience(bundle, brief.sector, resolvedAudience);
  const allNormalizationSets = candidateSiteSetsForPlanning(planningBundle, brief);
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

  const recommendationEvidence = evaluateEvidence(
    planningBundle.evidenceProfiles.recommendation,
  );

  function evaluate(sites: FrozenBundle["sites"]) {
    const measurement = estimatePackage(planningBundle, {
      sector: brief.sector,
      daypart: brief.daypart,
      siteIds: sites.map((site) => site.id),
      flightStart: brief.flightStart,
      flightEnd: brief.flightEnd,
    });
    const delivery = resolveObjectiveDelivery(planningBundle, brief, measurement);
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
      const site = planningBundle.sites.find((candidate) => candidate.id === siteId);
      if (!site) throw new Error("UNKNOWN_SITE_OVERRIDE:" + siteId);
      return site;
    });
    chosenEvaluation = evaluate(selectedSites);
    recommended = toCandidate(chosenEvaluation);
  }

  return {
    brief,
    recommended,
    packageOptions: selectPackageOptions(ranked),
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
