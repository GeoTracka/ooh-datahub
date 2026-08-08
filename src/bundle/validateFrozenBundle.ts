import { FrozenBundleSchema, type FrozenBundle } from "@/bundle/bundleSchema";
import { evaluateEvidence } from "@/planning/evidence";
import { verifyFeatureRegistry } from "@/planning/featureRegistry";

export function validateFrozenBundle(input: unknown): FrozenBundle {
  const bundle = FrozenBundleSchema.parse(input);
  if (bundle.manifest.maximumEvidenceGrade !== "D") {
    throw new Error("MVP runtime accepts Evidence D only");
  }
  for (const [profileId, profile] of Object.entries(bundle.evidenceProfiles)) {
    const result = evaluateEvidence(profile);
    if (
      profile.source !== 25 ||
      profile.minimumCritical !== 25 ||
      Math.min(...profile.caps) > 54 ||
      result.score !== 40 ||
      result.grade !== "D"
    ) {
      throw new Error("Synthetic evidence profile must evaluate to 40/D: " + profileId);
    }
  }
  const scenariosById = new Map(bundle.scenarios.map((scenario) => [scenario.id, scenario]));
  if (
    scenariosById.size !== 3 ||
    !scenariosById.has("low") ||
    !scenariosById.has("base") ||
    !scenariosById.has("high")
  ) {
    throw new Error("Scenarios must contain exactly one Low, Base, and High row");
  }
  const lowScenario = scenariosById.get("low")!;
  const baseScenario = scenariosById.get("base")!;
  const highScenario = scenariosById.get("high")!;
  for (const key of [
    "movementMultiplier",
    "visibilityMultiplier",
    "targetShareMultiplier",
  ] as const) {
    if (!(lowScenario[key] <= baseScenario[key] && baseScenario[key] <= highScenario[key])) {
      throw new Error("Scenario exposure multipliers must be monotone: " + key);
    }
  }
  if (
    lowScenario.propensityConcentration !== baseScenario.propensityConcentration ||
    baseScenario.propensityConcentration !== highScenario.propensityConcentration
  ) {
    throw new Error("Scenario propensity shape must remain fixed for coherent delivery ranges");
  }
  verifyFeatureRegistry(bundle.featureRegistry);
  const sourceIds = new Set<string>();
  for (const source of bundle.sourceManifest) {
    if (sourceIds.has(source.id)) throw new Error("Duplicate source manifest ID: " + source.id);
    sourceIds.add(source.id);
  }
  const sourceById = new Map(bundle.sourceManifest.map((source) => [source.id, source]));

  const requiredTechnicalSources = [
    ["feature:" + bundle.manifest.featureSnapshotId, "context_snapshot"],
    ["movement-model:" + bundle.manifest.modelVersion, "model"],
    ["schedule-model:" + bundle.manifest.scheduleModelVersion, "model"],
    ["exposure-geometry:" + bundle.manifest.exposureGeometryVersion, "exposure_geometry"],
    ["panel:" + bundle.manifest.panelVersion, "panel"],
    ["overlap-model:conditional-poisson-weighted-panel-v1", "model"],
    ["replicate-set:" + bundle.manifest.replicateSetId, "replicate_set"],
    ["influence-linkage:" + bundle.manifest.influenceLinkageAssumptionId, "assumption"],
    ["influence-sensitivity:" + bundle.manifest.influenceSensitivityId, "assumption"],
  ] as const;
  for (const [sourceId, kind] of requiredTechnicalSources) {
    const source = sourceById.get(sourceId);
    if (!source || source.kind !== kind) {
      throw new Error("Missing technical source record: " + sourceId);
    }
  }

  const targetKeys = new Set<string>();
  for (const target of bundle.targets) {
    const targetKey = target.sector + "/" + target.cellId;
    if (targetKeys.has(targetKey)) throw new Error("Duplicate target cell: " + targetKey);
    targetKeys.add(targetKey);
    if (
      !sourceIds.has(target.universeSourceId) ||
      !sourceIds.has(target.qiSourceId) ||
      !sourceIds.has(target.serviceabilitySourceId)
    ) {
      throw new Error("Dangling target source: " + target.sector + "/" + target.cellId);
    }
    for (const [sourceId, kind] of [
      [target.universeSourceId, "target_universe"],
      [target.qiSourceId, "influence"],
      [target.serviceabilitySourceId, "serviceability"],
    ] as const) {
      const source = sourceById.get(sourceId)!;
      if (
        source.kind !== kind ||
        source.sector !== target.sector ||
        source.geographyId !== bundle.manifest.geographyId ||
        source.productScope !== target.sector ||
        source.periodStart > source.periodEnd
      ) {
        throw new Error("Incompatible target source: " + sourceId);
      }
    }
    const panelWeight = bundle.panel
      .filter((member) => member.sector === target.sector && member.cellId === target.cellId)
      .reduce((sum, member) => sum + member.weight, 0);
    if (Math.abs(panelWeight - target.universe) > 0.000001) {
      throw new Error("Panel weight does not equal universe: " + target.sector + "/" + target.cellId);
    }
  }
  const panelIds = new Set<string>();
  for (const member of bundle.panel) {
    if (panelIds.has(member.id)) throw new Error("Duplicate panel member: " + member.id);
    panelIds.add(member.id);
    if (!targetKeys.has(member.sector + "/" + member.cellId)) {
      throw new Error("Panel member outside target partition: " + member.id);
    }
  }
  for (const site of bundle.sites) {
    const geometrySource = sourceById.get(site.exposureGeometry.sourceId);
    if (!geometrySource || geometrySource.kind !== "exposure_geometry") {
      throw new Error("Dangling exposure geometry source: " + site.id);
    }
    const effectiveVisibility =
      site.exposureGeometry.orientationFactor * site.exposureGeometry.viewZoneFactor;
    if (Math.abs(effectiveVisibility - site.visibility) > 1e-9) {
      throw new Error("Exposure geometry does not reconcile to visibility: " + site.id);
    }

    for (const sector of ["fmcg", "real_estate", "bank_fintech"] as const) {
      const allocationSourceId = bundle.targetAllocationSourceIds[sector];
      const allocationSource = sourceById.get(allocationSourceId);
      if (!allocationSource) {
        throw new Error("Dangling target allocation source: " + allocationSourceId);
      }
      if (
        allocationSource.kind !== "target_allocation" ||
        allocationSource.sector !== sector ||
        allocationSource.geographyId !== bundle.manifest.geographyId ||
        allocationSource.productScope !== sector ||
        allocationSource.periodStart > allocationSource.periodEnd
      ) {
        throw new Error("Incompatible target allocation source: " + allocationSourceId);
      }
      const expectedCells = bundle.targets
        .filter((target) => target.sector === sector)
        .map((target) => target.cellId)
        .sort();
      const actualCells = Object.keys(site.targetShareBySector[sector]).sort();
      if (actualCells.join("|") !== expectedCells.join("|")) {
        throw new Error("Target share partition mismatch: " + site.id + "/" + sector);
      }
      const shareTotal = Object.values(site.targetShareBySector[sector])
        .reduce((sum, share) => sum + share, 0);
      const exceedsScenarioAllocation = bundle.scenarios.some(
        (scenario) => shareTotal * scenario.targetShareMultiplier > 1,
      );
      if (shareTotal > 1 || exceedsScenarioAllocation) {
        throw new Error("Target shares exceed a probability bound: " + site.id + "/" + sector);
      }
    }
  }
  return bundle;
}
