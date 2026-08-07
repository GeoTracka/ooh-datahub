import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";
import type {
  EstimatePackageResult,
  MetricClaim,
  MetricEvidence,
  PanelFailureCode,
  ScenarioMeasurement,
} from "@/contracts/metrics";
import { MetricClaimSchema } from "@/contracts/metrics";
import { activityPotential } from "@/planning/activityPotential";
import { evaluateEvidence } from "@/planning/evidence";
import { generalOts, targetOts } from "@/planning/exposure";
import { resolveClaimLadder } from "@/planning/claimLadder";
import { exposurePlanFingerprint, reachComparabilityKey } from "@/planning/fingerprint";
import { influenceCapturePct } from "@/planning/influence";
import {
  inclusiveFlightDays,
  materializeExposureBlocks,
  passageEvents,
  siteDeliveryCompatible,
} from "@/planning/movement";
import {
  influenceInputsCompatible,
  serviceabilityInputsCompatible,
  targetAllocationInputsCompatible,
  targetUniverseInputsCompatible,
} from "@/planning/sourceEligibility";
import { runStablePanel } from "@/planning/overlapPanel";

export type EstimateRequest = {
  sector: Sector;
  daypart: Daypart;
  siteIds: string[];
  flightStart: string;
  flightEnd: string;
};

type Site = FrozenBundle["sites"][number];
type ExposureGeometry = Site["exposureGeometry"];

const panelFailures = new Set<PanelFailureCode>([
  "SCALING_OUTSIDE_ENVELOPE",
  "MEMBER_RATE_OUTSIDE_ENVELOPE",
  "FREQUENCY_OUTSIDE_ENVELOPE",
]);

function panelFailureCode(error: unknown): PanelFailureCode | null {
  if (!(error instanceof Error)) return null;
  return panelFailures.has(error.message as PanelFailureCode)
    ? error.message as PanelFailureCode
    : null;
}

function exposureGeometry(site: Site): ExposureGeometry | null {
  return (site as Site & { exposureGeometry?: ExposureGeometry }).exposureGeometry ?? null;
}

function effectiveVisibility(site: Site): number | null {
  const geometry = exposureGeometry(site);
  if (!geometry) return null;
  return geometry.orientationFactor * geometry.viewZoneFactor;
}

function exposureGeometrySourceCompatible(bundle: FrozenBundle, site: Site): boolean {
  const geometry = exposureGeometry(site);
  if (!geometry) return false;
  const source = bundle.sourceManifest.find((item) => item.id === geometry.sourceId);
  return Boolean(
    source &&
    source.kind === "exposure_geometry" &&
    source.geographyId === bundle.manifest.geographyId &&
    source.productScope === "all" &&
    source.periodStart <= bundle.manifest.createdAt.slice(0, 10) &&
    source.periodEnd >= bundle.manifest.createdAt.slice(0, 10),
  );
}

const claimRank = {
  context: 0,
  activity_potential: 1,
  movement: 2,
  general_ots: 3,
  target_ots: 4,
  scenario_target_reach: 5,
  calibrated_target_reach: 6,
} as const;

function permits(
  highest: keyof typeof claimRank,
  required: keyof typeof claimRank,
): boolean {
  return claimRank[highest] >= claimRank[required];
}

export function estimatePackage(
  bundle: FrozenBundle,
  request: EstimateRequest,
): EstimatePackageResult {
  const selected = request.siteIds.map((id) => {
    const site = bundle.sites.find((candidate) => candidate.id === id);
    if (!site) throw new Error("Unknown site: " + id);
    return site;
  });
  const scheduleCompatible = selected.every((site) => siteDeliveryCompatible(
    site,
    request.flightStart,
    request.flightEnd,
  ));
  const orientationAvailable = selected.every((site) => {
    const geometry = exposureGeometry(site);
    return Boolean(
      geometry &&
      Number.isFinite(geometry.orientationDeg) &&
      Number.isFinite(geometry.orientationFactor),
    );
  });
  const viewZoneAvailable = selected.every((site) => {
    const geometry = exposureGeometry(site);
    return Boolean(geometry && Number.isFinite(geometry.viewZoneFactor));
  });
  const geometrySourcesCompatible = selected.every((site) =>
    exposureGeometrySourceCompatible(bundle, site)
  );
  const flightDays = inclusiveFlightDays(request.flightStart, request.flightEnd);
  const scheduleBlocks = materializeExposureBlocks(
    request.flightStart,
    request.flightEnd,
    request.daypart,
  );
  const dataRevision = bundle.manifest.dataRevision;
  const targetUniverseAvailable = targetUniverseInputsCompatible(bundle, request);
  const targetAllocationAvailable = targetAllocationInputsCompatible(bundle, request);
  const influenceCompatible = influenceInputsCompatible(bundle, request);
  const serviceabilityCompatible = serviceabilityInputsCompatible(bundle, request);
  const inventorySourceIds = bundle.sourceManifest
    .filter((source) => source.kind === "inventory")
    .map((source) => source.id)
    .sort();
  const universeSourceIds = bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.universeSourceId);
  const allocationSourceIds = [bundle.targetAllocationSourceIds[request.sector]];
  const influenceSourceIds = [...new Set(bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.qiSourceId))].sort();
  const serviceabilitySourceIds = [...new Set(bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.serviceabilitySourceId))].sort();
  const exposureGeometrySourceIds = [...new Set(selected.flatMap((site) => {
    const geometry = exposureGeometry(site);
    return geometry ? [geometry.sourceId] : [];
  }))].sort();
  const movementSourceIds = [...new Set([
    ...inventorySourceIds,
    "feature:" + bundle.manifest.featureSnapshotId,
    "movement-model:" + bundle.manifest.modelVersion,
    "schedule-model:" + bundle.manifest.scheduleModelVersion,
  ])].sort();
  const generalOtsSourceIds = [...new Set([
    ...movementSourceIds,
    ...exposureGeometrySourceIds,
  ])].sort();
  const targetOtsSourceIds = [...new Set([
    ...generalOtsSourceIds,
    ...universeSourceIds,
    ...allocationSourceIds,
  ])].sort();
  const uniqueReachSourceIds = [...new Set([
    ...targetOtsSourceIds,
    "panel:" + bundle.manifest.panelVersion,
    "overlap-model:conditional-poisson-weighted-panel-v1",
    "replicate-set:" + bundle.manifest.replicateSetId,
  ])].sort();
  const influenceClaimSourceIds = [...new Set([
    ...uniqueReachSourceIds,
    ...influenceSourceIds,
    "influence-linkage:" + bundle.manifest.influenceLinkageAssumptionId,
    "influence-sensitivity:" + bundle.manifest.influenceSensitivityId,
  ])].sort();
  const serviceabilityClaimSourceIds = [...new Set([
    ...uniqueReachSourceIds,
    ...serviceabilitySourceIds,
  ])].sort();
  const claimResolution = resolveClaimLadder({
    geocode: "not_needed",
    fallbackFacts: "seeded",
    runtimeFailure: "none",
    calibration: "inside",
    activityPotentialAvailable: bundle.activityCohort.length >= 30,
    movementAvailable: true,
    movementUnit: "person_passages",
    personConversionAvailable: true,
    orientationAvailable,
    viewZoneAvailable,
    schedule: scheduleCompatible ? "assumed" : "missing",
    visibilityAndDeliveryAvailable:
      scheduleCompatible && orientationAvailable && viewZoneAvailable && geometrySourcesCompatible,
    targetUniverseAvailable,
    targetAllocationAvailable,
    overlap: "assumed",
    qiAvailable: influenceCompatible,
  });
  const canGeneralOts = permits(claimResolution.highest, "general_ots");
  const canTargetOts = permits(claimResolution.highest, "target_ots");
  const canUniqueReach = permits(claimResolution.highest, "scenario_target_reach");

  const scenarios: ScenarioMeasurement[] = bundle.scenarios.map((scenario) => {
    if (!canTargetOts) {
      return {
        id: scenario.id,
        reach: null,
        targetOts: null,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode: null,
      };
    }
    const siteInputs = selected.map((site) => {
      const shares = site.targetShareBySector[request.sector];
      const visibility = effectiveVisibility(site);
      if (visibility === null) throw new Error("EXPOSURE_GEOMETRY_UNAVAILABLE");
      return {
        siteId: site.id,
        zoneId: site.zoneId,
        blocks: scheduleBlocks.map((block) => {
          const movement = passageEvents(
            site.baseMovement[block.daypart],
            scenario.movementMultiplier,
          );
          const ots = generalOts(
            movement,
            Math.min(1, visibility * scenario.visibilityMultiplier),
            site.deliverySchedule.uptime * site.deliverySchedule.shareOfTime,
          );
          return {
            blockId: block.date + "/" + block.daypart,
            daypart: block.daypart,
            byCell: Object.fromEntries(
              Object.entries(shares).map(([cellId, share]) => [
                cellId,
                targetOts(ots, share * scenario.targetShareMultiplier),
              ]),
            ),
          };
        }),
      };
    });
    const targetOtsValue = siteInputs.reduce(
      (siteSum, site) => siteSum + site.blocks.reduce(
        (blockSum, block) => blockSum + Object.values(block.byCell)
          .reduce((cellSum, value) => cellSum + value, 0),
        0,
      ),
      0,
    );
    if (!canUniqueReach) {
      return {
        id: scenario.id,
        reach: null,
        targetOts: targetOtsValue,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode: null,
      };
    }
    try {
      const panel = runStablePanel(
        bundle,
        request.sector,
        siteInputs,
        scenario.propensityConcentration,
      );
      return {
        id: scenario.id,
        reach: panel.reach,
        targetOts: panel.targetOts,
        influenceCapture: influenceCompatible
          ? influenceCapturePct(panel.influenceMass, panel.influenceUniverse)
          : null,
        influenceMass: influenceCompatible ? panel.influenceMass : null,
        serviceableReach: serviceabilityCompatible ? panel.serviceableReach : null,
        averageFrequency: panel.averageFrequency,
        failureCode: null,
      };
    } catch (error) {
      const failureCode = panelFailureCode(error);
      if (!failureCode) throw error;
      return {
        id: scenario.id,
        reach: null,
        targetOts: targetOtsValue,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode,
      };
    }
  });

  const low = scenarios.find((item) => item.id === "low")!;
  const base = scenarios.find((item) => item.id === "base")!;
  const high = scenarios.find((item) => item.id === "high")!;
  const universe = bundle.targets
    .filter((target) => target.sector === request.sector)
    .reduce((sum, target) => sum + target.universe, 0);
  const evidenceResults = {
    activityPotential: evaluateEvidence(bundle.evidenceProfiles.activityPotential),
    movement: evaluateEvidence(bundle.evidenceProfiles.movement),
    generalOts: evaluateEvidence(bundle.evidenceProfiles.generalOts),
    targetOts: evaluateEvidence(bundle.evidenceProfiles.targetOts),
    reach: evaluateEvidence(bundle.evidenceProfiles.reach),
    influence: evaluateEvidence(bundle.evidenceProfiles.influence),
    serviceability: evaluateEvidence(bundle.evidenceProfiles.serviceability),
  };
  const reachEvidence = evidenceResults.reach;
  const influenceEvidence = evidenceResults.influence;
  const serviceabilityEvidence = evidenceResults.serviceability;
  if (reachEvidence.grade !== "D") {
    throw new Error("SEEDED_REACH_EVIDENCE_NOT_D");
  }

  const baseScenarioDefinition = bundle.scenarios.find((scenario) => scenario.id === "base")!;
  const baseMovement = selected.reduce((siteSum, site) =>
    siteSum + scheduleBlocks.reduce((blockSum, block) => blockSum + passageEvents(
      site.baseMovement[block.daypart],
      baseScenarioDefinition.movementMultiplier,
    ), 0),
  0);
  const baseGeneralOts = canGeneralOts
    ? selected.reduce((siteSum, site) => {
        const visibility = effectiveVisibility(site);
        if (visibility === null) throw new Error("EXPOSURE_GEOMETRY_UNAVAILABLE");
        return siteSum + scheduleBlocks.reduce((blockSum, block) => blockSum + generalOts(
          passageEvents(
            site.baseMovement[block.daypart],
            baseScenarioDefinition.movementMultiplier,
          ),
          Math.min(1, visibility * baseScenarioDefinition.visibilityMultiplier),
          site.deliverySchedule.uptime * site.deliverySchedule.shareOfTime,
        ), 0);
      }, 0)
    : 0;
  const hasReach = canUniqueReach &&
    scenarios.every((scenario) => scenario.reach !== null);
  const failureCode = scenarios.find((scenario) => scenario.failureCode)?.failureCode;
  const activityPotentialValue = activityPotential(
    baseMovement,
    bundle.activityCohort.map((location) => location.value),
  );
  const claim: MetricClaim = MetricClaimSchema.parse(hasReach
    ? {
        id: "target-reach",
        kind: "scenario_target_reach",
        label: "Scenario target reach",
        state: "assumed",
        evidence: reachEvidence.grade,
        unit: "people",
        universe,
        range: {
          type: "scenario",
          low: low.reach!,
          base: base.reach!,
          high: high.reach!,
        },
        sourceIds: uniqueReachSourceIds,
        caveats: ["Conditional-Poisson overlap scenario; not buying currency"],
        applicability: "inside",
      }
    : canTargetOts && base.targetOts !== null
      ? {
          id: "target-ots",
          kind: "target_ots",
          label: "Target opportunity to see",
          state: "assumed",
          evidence: evidenceResults.targetOts.grade,
          unit: "ots",
          value: base.targetOts,
          sourceIds: targetOtsSourceIds,
          caveats: ["Unique reach unavailable: " + (failureCode ?? claimResolution.reasonCode)],
          applicability: "outside",
        }
      : canGeneralOts
        ? {
            id: "general-ots",
            kind: "general_ots",
            label: "General opportunity to see",
            state: "modelled",
            evidence: evidenceResults.generalOts.grade,
            unit: "ots",
            value: baseGeneralOts,
            sourceIds: generalOtsSourceIds,
            caveats: ["Target reach is unavailable because the target basis is incompatible"],
            applicability: "outside",
          }
        : permits(claimResolution.highest, "movement")
          ? {
              id: "movement",
              kind: "movement",
              label: "Modelled person movement",
              state: "modelled",
              evidence: evidenceResults.movement.grade,
              unit: "person_passages",
              value: baseMovement,
              sourceIds: movementSourceIds,
              caveats: [
                "OTS unavailable because exposure geometry or the requested face schedule is incomplete",
              ],
              applicability: "outside",
            }
          : activityPotentialValue !== null &&
              permits(claimResolution.highest, "activity_potential")
            ? {
                id: "activity-potential",
                kind: "activity_potential",
                label: "Activity Potential",
                state: "modelled",
                evidence: evidenceResults.activityPotential.grade,
                unit: "index_0_100",
                value: activityPotentialValue,
                sourceIds: movementSourceIds,
                caveats: ["Relative cohort index; not footfall or reach"],
                applicability: "outside",
              }
            : {
                id: "audience-delivery-unavailable",
                kind: "unavailable",
                label: "Audience delivery unavailable",
                state: "unavailable",
                evidence: "unavailable",
                unit: "none",
                reasonCode: claimResolution.reasonCode ?? "MEASUREMENT_INPUTS_UNAVAILABLE",
                sourceIds: [],
                caveats: ["No eligible audience-delivery claim can be made"],
                applicability: "unknown",
              });

  const hasInfluence = hasReach && influenceCompatible && claimResolution.influenceEligible &&
    influenceEvidence.grade === "D" && scenarios.every(
      (scenario) => scenario.influenceCapture !== null && scenario.influenceMass !== null,
    );
  const influence: MetricClaim | null = hasInfluence
    ? MetricClaimSchema.parse({
        id: "influence-capture",
        kind: "influence_capture",
        label: "Influence Capture",
        state: "assumed",
        evidence: influenceEvidence.grade,
        unit: "percent",
        qiSourceId: influenceSourceIds[0],
        range: {
          type: "scenario",
          low: low.influenceCapture!,
          base: base.influenceCapture!,
          high: high.influenceCapture!,
        },
        sourceIds: influenceClaimSourceIds,
        caveats: [
          "Exposure coverage of an assumed influence-weighted universe",
          "Conditional independence of influence propensity and exposure is assumed within each cell; Low/Base/High jointly vary movement and propensity concentration as the registered sensitivity",
        ],
        applicability: "inside",
      })
    : null;

  const hasServiceability = hasReach && serviceabilityCompatible &&
    serviceabilityEvidence.grade === "D" &&
    scenarios.every((scenario) => scenario.serviceableReach !== null);
  const unavailableEvidence: MetricEvidence = {
    score: 0,
    grade: "unavailable",
    sourceIds: [],
  };
  const evidenceForClaim = claim.kind === "activity_potential"
    ? evidenceResults.activityPotential
    : claim.kind === "movement"
      ? evidenceResults.movement
      : claim.kind === "general_ots"
        ? evidenceResults.generalOts
        : claim.kind === "target_ots"
          ? evidenceResults.targetOts
          : claim.kind === "scenario_target_reach" || claim.kind === "calibrated_target_reach"
            ? evidenceResults.reach
            : null;
  const permittedClaimEvidence: MetricEvidence = evidenceForClaim
    ? { ...evidenceForClaim, sourceIds: claim.sourceIds }
    : unavailableEvidence;
  const uniqueReachEvidence: MetricEvidence | null = hasReach
    ? { ...reachEvidence, sourceIds: uniqueReachSourceIds }
    : null;
  const influenceMetricEvidence: MetricEvidence | null = hasInfluence
    ? { ...influenceEvidence, sourceIds: influenceClaimSourceIds }
    : null;
  const serviceabilityMetricEvidence: MetricEvidence | null = hasServiceability
    ? { ...serviceabilityEvidence, sourceIds: serviceabilityClaimSourceIds }
    : null;

  const fingerprint = exposurePlanFingerprint(bundle, {
    sector: request.sector,
    daypart: request.daypart,
    siteIds: request.siteIds,
    flightStart: request.flightStart,
    flightEnd: request.flightEnd,
    flightDays,
    scheduleBlocks,
    exposureThreshold: "1+",
  });
  const comparabilityKey = reachComparabilityKey({
    sector: request.sector,
    geography: "lagos-demo-v1",
    flightStart: request.flightStart,
    flightEnd: request.flightEnd,
    basis: "target-ots",
    threshold: "1+",
    panelVersion: bundle.manifest.panelVersion,
    modelVersion: bundle.manifest.modelVersion,
    targetUniverseVersion: bundle.manifest.targetUniverseVersion,
    targetAllocationSourceId: bundle.targetAllocationSourceIds[request.sector],
    featureSchemaCompatibilityId: bundle.manifest.featureSchemaCompatibilityId,
    replicateSetId: bundle.manifest.replicateSetId,
    targetCellPartitionId: bundle.manifest.targetCellPartitionId,
    scheduleModelVersion: bundle.manifest.scheduleModelVersion,
    flightDays,
  });

  const uniqueUniverseSourceIds = [...new Set(universeSourceIds)].sort();
  const geometrySourceLabel = exposureGeometrySourceIds.length > 0
    ? exposureGeometrySourceIds.join(", ")
    : "Exposure geometry unavailable";

  return {
    claim,
    influence,
    evidence: {
      permittedClaim: permittedClaimEvidence,
      uniqueReach: uniqueReachEvidence,
      influence: influenceMetricEvidence,
      serviceability: serviceabilityMetricEvidence,
    },
    availability: {
      influence: hasInfluence
        ? { reasonCode: null, recoveryAction: null }
        : !hasReach
          ? {
              reasonCode: "UNIQUE_REACH_UNAVAILABLE",
              recoveryAction: "Restore an eligible unique-reach basis first",
            }
          : !influenceCompatible
            ? {
                reasonCode: "INFLUENCE_PROFILE_INCOMPATIBLE",
                recoveryAction: "Provide a current governed qi profile for this sector and flight",
              }
            : {
                reasonCode: "INFLUENCE_EVIDENCE_UNAVAILABLE",
                recoveryAction: "Restore an eligible influence evidence profile",
              },
      serviceability: hasServiceability
        ? { reasonCode: null, recoveryAction: null }
        : !hasReach
          ? {
              reasonCode: "UNIQUE_REACH_UNAVAILABLE",
              recoveryAction: "Restore an eligible unique-reach basis first",
            }
          : !serviceabilityCompatible
            ? {
                reasonCode: "SERVICEABILITY_PROFILE_INCOMPATIBLE",
                recoveryAction: "Provide a current governed serviceability profile for this sector and flight",
              }
            : {
                reasonCode: "SERVICEABILITY_EVIDENCE_UNAVAILABLE",
                recoveryAction: "Restore an eligible serviceability evidence profile",
              },
    },
    scenarios,
    stages: [
      {
        id: "location",
        state: "assumed",
        valueText: selected.length + " selected synthetic media faces with declared orientation",
        sourceLabel: inventorySourceIds.join(", "),
        freshnessLabel: bundle.manifest.createdAt.slice(0, 10),
        transformation: "Selected IDs resolve to frozen coordinates, face orientation, and view-zone assumptions",
        nextMapping: "The frozen context/model snapshot provides the corresponding base movement output",
        caveats: ["Synthetic demo inventory and exposure geometry"],
        recoveryAction: null,
      },
      {
        id: "places",
        state: "assumed",
        valueText: "Frozen context snapshot; per-feature values not materialized",
        sourceLabel: "feature:" + bundle.manifest.featureSnapshotId,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "No live POI/place feature calculation runs here; baseMovement is the frozen model output associated with this context snapshot",
        nextMapping: "Frozen baseMovement enters the Movement scenario",
        caveats: [
          "Do not interpret this stage as observed visits or a runtime POI-to-movement calculation",
        ],
        recoveryAction: null,
      },
      {
        id: "movement",
        state: "modelled",
        valueText: String(Math.round(baseMovement)) + " person passages",
        sourceLabel: "movement-model:" + bundle.manifest.modelVersion,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "Frozen base movement × coherent Base scenario multiplier × campaign schedule blocks",
        nextMapping: "Movement is filtered by declared orientation, view-zone, and delivery factors",
        caveats: ["Scenario movement; not a live traffic count"],
        recoveryAction: null,
      },
      {
        id: "ots",
        state: canGeneralOts ? "modelled" : "unavailable",
        valueText: canGeneralOts
          ? String(Math.round(baseGeneralOts)) + " general OTS"
          : "OTS unavailable",
        sourceLabel: geometrySourceLabel,
        freshnessLabel: bundle.manifest.exposureGeometryVersion,
        transformation: "Movement × orientation factor × view-zone factor × delivery uptime/share",
        nextMapping: "General OTS is allocated to target cells",
        caveats: canGeneralOts
          ? ["Opportunity to see is not unique people; exposure geometry is synthetic Evidence D"]
          : ["A selected face is missing compatible exposure geometry or flight delivery"],
        recoveryAction: canGeneralOts
          ? null
          : claimResolution.recoveryAction,
      },
      {
        id: "target",
        state: base.targetOts !== null ? "assumed" : "unavailable",
        valueText: base.targetOts !== null
          ? String(Math.round(base.targetOts)) + " target OTS"
          : "Target OTS unavailable",
        sourceLabel: uniqueUniverseSourceIds.join(", "),
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "General OTS × governed sector/cell allocation",
        nextMapping: "Target OTS scales the stable overlap panel",
        caveats: targetUniverseAvailable && targetAllocationAvailable
          ? ["Target allocation is assumed in the seeded bundle"]
          : ["A compatible target universe and allocation source are both required"],
        recoveryAction: base.targetOts !== null
          ? null
          : claimResolution.recoveryAction,
      },
      {
        id: "unique",
        state: hasReach ? "assumed" : "unavailable",
        valueText: hasReach
          ? String(Math.round(base.reach!)) + " target people 1+"
          : "Unique reach unavailable",
        sourceLabel: "overlap-model:conditional-poisson-weighted-panel-v1",
        freshnessLabel: bundle.manifest.replicateSetId,
        transformation: "Stable member propensities → 1 − exp(−Σλ)",
        nextMapping: "Eligible unique delivery enters the objective Delivery pillar once",
        caveats: claim.caveats,
        recoveryAction: hasReach
          ? null
          : claimResolution.recoveryAction ?? "Return to Target OTS or fit an eligible overlap model",
      },
    ],
    fingerprint,
    comparabilityKey,
    replay: {
      bundleId: bundle.manifest.id,
      bundleSchemaVersion: bundle.manifest.schemaVersion,
      modelVersion: bundle.manifest.modelVersion,
      featureSnapshotId: bundle.manifest.featureSnapshotId,
      featureSchemaCompatibilityId: bundle.manifest.featureSchemaCompatibilityId,
      exposureGeometryVersion: bundle.manifest.exposureGeometryVersion,
      evidenceProfileVersion: bundle.manifest.evidenceProfileVersion,
      scheduleModelVersion: bundle.manifest.scheduleModelVersion,
      influenceLinkageAssumptionId: bundle.manifest.influenceLinkageAssumptionId,
      influenceSensitivityId: bundle.manifest.influenceSensitivityId,
      sourceManifestIds: bundle.sourceManifest.map((source) => source.id).sort(),
      enrichmentSnapshotId: null,
      dataRevision,
      exposurePlanFingerprint: fingerprint,
      comparabilityKey,
      overlapMethodId: "conditional-poisson-weighted-panel-v1",
      replicateSetId: bundle.manifest.replicateSetId,
      seed: bundle.manifest.seed,
      controls: {
        sector: request.sector,
        daypart: request.daypart,
        flightStart: request.flightStart,
        flightEnd: request.flightEnd,
        flightDays,
        scheduleBlocks,
        siteIds: [...request.siteIds].sort(),
        exposureThreshold: "1+",
      },
    },
  };
}
