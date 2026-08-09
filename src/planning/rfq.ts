import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { PlanningResult } from "@/contracts/domain";
import {
  RfqReviewInputSchema,
  type AudiencePlanningBasis,
  type RfqDraft,
  type RfqRange,
  type SupplierRfqLine,
} from "@/contracts/rfq";
import { resolveBriefAudience } from "@/planning/briefNormalization";
import { canonicalJson } from "@/shared/canonicalJson";

const requested = {
  identityAndOrientation: "REQUESTED",
  dimensions: "REQUESTED",
  availability: "REQUESTED",
  grossAndNetRate: "REQUESTED",
  production: "REQUESTED",
  installation: "REQUESTED",
  taxes: "REQUESTED",
  leadTime: "REQUESTED",
  permitOrAuthorization: "REQUESTED",
  proofOfPostingOrPlay: "REQUESTED",
  measurementDeliverables: "REQUESTED",
  faceLevelAudienceMethodFiles: "REQUESTED",
} as const;

function parseReview(rawReview: unknown) {
  const parsed = RfqReviewInputSchema.safeParse(rawReview);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "RFQ_REVIEW_INVALID");
  }
  return parsed.data;
}

function reachShareRange(range: RfqRange, universe: number): RfqRange {
  return range.type === "scenario"
    ? {
        type: "scenario",
        low: 100 * range.low / universe,
        base: 100 * range.base / universe,
        high: 100 * range.high / universe,
      }
    : {
        type: "quantile",
        p10: 100 * range.p10 / universe,
        p50: 100 * range.p50 / universe,
        p90: 100 * range.p90 / universe,
      };
}

function renderSupplierLine(line: SupplierRfqLine): string {
  return [
    "Asset/structure/face: " + line.assetId + " / " +
      (line.structureId ?? "Confirmation requested") + " / " + line.faceId,
    "Address/coordinate: " + line.address + " / " +
      line.coordinate.latitude + ", " + line.coordinate.longitude,
    "Format/class/dimensions: " + line.format + " / " + line.mediaClass + " / " +
      (line.dimensions ?? "Confirmation requested"),
    "Schedule: " + line.requestedSchedule.start + " to " +
      line.requestedSchedule.end + " / " + line.requestedSchedule.daypart +
      " / quantity " + line.requestedSchedule.quantity + " / share of time " +
      (line.requestedSchedule.shareOfTimePercent ?? "Confirmation requested"),
    "Indicative rate: NGN " + line.indicativeRate.amount +
      " / " + line.indicativeRate.basis,
    "Confirm: " + Object.keys(line.confirmationRequests).sort().join(", "),
  ].join("\n");
}

export function generateRfq(
  bundle: FrozenBundle,
  appliedPlan: PlanningResult,
  rawReview: unknown,
): RfqDraft {
  if (!appliedPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
  if (!appliedPlan.measurement) throw new Error("STALE_APPLIED_PLAN");
  if (!appliedPlan.replay) throw new Error("STALE_APPLIED_PLAN");
  if (
    appliedPlan.recommended.estimateFingerprint !== appliedPlan.measurement.fingerprint ||
    appliedPlan.replay.exposurePlanFingerprint !== appliedPlan.measurement.fingerprint ||
    appliedPlan.measurement.replay.exposurePlanFingerprint !== appliedPlan.measurement.fingerprint ||
    [...appliedPlan.recommended.siteIds].sort().join("|") !==
      [...appliedPlan.replay.controls.siteIds].sort().join("|")
  ) throw new Error("STALE_APPLIED_PLAN");
  const review = parseReview(rawReview);
  const resolvedAudience = resolveBriefAudience(bundle, appliedPlan.brief);
  const activeSites = appliedPlan.recommended.siteIds.map((siteId) => {
    const site = bundle.sites.find((candidate) => candidate.id === siteId);
    if (!site) throw new Error("UNKNOWN_ASSET");
    return site;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const supplierIds = [...new Set(activeSites.map((site) => site.supplierId))].sort();
  if (Object.keys(review.supplierNotes).some((id) => !supplierIds.includes(id))) {
    throw new Error("UNKNOWN_SUPPLIER_NOTE");
  }
  const lines: SupplierRfqLine[] = activeSites.map((site) => ({
    supplierId: site.supplierId,
    ownerSeller: site.supplierId,
    assetId: site.id,
    structureId: null,
    faceId: site.id,
    address: site.label,
    coordinate: { longitude: site.coordinate[0], latitude: site.coordinate[1] },
    format: site.format,
    dimensions: null,
    mediaClass: site.format === "dooh" ? "DOOH" : "STATIC",
    requestedSchedule: {
      start: review.flightStart,
      end: review.flightEnd,
      daypart: appliedPlan.brief.daypart,
      quantity: 1,
      shareOfTimePercent: site.format === "dooh"
        ? site.deliverySchedule.shareOfTime * 100
        : null,
    },
    indicativeRate: {
      amount: site.rateNgn,
      currency: "NGN",
      basis: "illustrative_demo_line_rate",
    },
    confirmationRequests: requested,
  }));
  const changedSchedule =
    review.flightStart !== appliedPlan.brief.flightStart ||
    review.flightEnd !== appliedPlan.brief.flightEnd;
  const contextOnly = appliedPlan.recommended.mode === "context_shortlist";
  const estimateValidity: AudiencePlanningBasis["estimateValidity"] = contextOnly
    ? "CONTEXT_SHORTLIST_ONLY"
    : changedSchedule
      ? "RFQ_SCHEDULE_REQUIRES_RECOMPUTE"
      : "EXACT_APPLIED_PLAN";
  const reachClaim = estimateValidity === "EXACT_APPLIED_PLAN" && (
    appliedPlan.measurement.claim.kind === "scenario_target_reach" ||
    appliedPlan.measurement.claim.kind === "calibrated_target_reach"
  )
    ? appliedPlan.measurement.claim
    : null;
  const influenceClaim = estimateValidity === "EXACT_APPLIED_PLAN"
    ? appliedPlan.measurement.influence
    : null;
  const influenceProfileVersion = influenceClaim?.kind === "influence_capture"
    ? influenceClaim.qiSourceId
    : influenceClaim?.kind === "influence_weighted_coverage"
      ? influenceClaim.weightSourceId
      : null;
  const audiencePlanningBasis: AudiencePlanningBasis = {
    estimateValidity,
    targetReach: reachClaim,
    targetDefinition: resolvedAudience.label,
    targetUniverse: reachClaim?.universe ?? null,
    targetReachSharePercent: reachClaim
      ? reachShareRange(reachClaim.range, reachClaim.universe)
      : null,
    influenceCapture: influenceClaim,
    priorityInfluenceArchetypes: bundle.targets
      .filter((target) => target.sector === appliedPlan.brief.sector)
      .map((target) => target.cellId)
      .sort(),
    exposureBasis: "target people with at least one modelled OOH opportunity to see",
    exposureThreshold: "1+",
    modelVersion: bundle.manifest.modelVersion,
    targetUniverseVersion: bundle.manifest.targetUniverseVersion,
    influenceProfileVersion,
    intervalType: reachClaim?.range.type ?? "unavailable",
    contextRevision: appliedPlan.contextRevision ? {
      enrichmentSnapshotId: appliedPlan.contextRevision.enrichmentSnapshotId,
      dataRevision: appliedPlan.contextRevision.dataRevision,
      decisionUse: "context_only",
      reasonCode: appliedPlan.contextRevision.claimResolution.reasonCode,
      selectedRows: appliedPlan.contextRevision.selectedRows,
    } : null,
    evidence: {
      recommendation: appliedPlan.recommended.evidenceGrade,
      reach: appliedPlan.measurement.evidence.uniqueReach?.grade ?? "unavailable",
      influence: appliedPlan.measurement.evidence.influence?.grade ?? null,
    },
    limitations: [
      ...appliedPlan.measurement.claim.caveats,
      ...(changedSchedule ? ["Reviewed RFQ schedule differs; recompute audience estimates before reliance"] : []),
      ...(contextOnly ? ["Audience delivery unavailable; context shortlist only"] : []),
    ],
    replay: appliedPlan.replay,
  };
  const campaign = {
    product: {
      name: appliedPlan.brief.productName,
      description: appliedPlan.brief.productDescription,
    },
    sector: appliedPlan.brief.sector,
    objective: appliedPlan.brief.objective,
    targetAudience: appliedPlan.brief.targetAudience,
    geography: {
      market: "Lagos" as const,
      zones: appliedPlan.selectedZoneIds.map((id) => ({
        id,
        label: bundle.zones.find((zone) => zone.id === id)?.label ?? id,
      })),
    },
    flight: {
      start: review.flightStart,
      end: review.flightEnd,
      daypart: appliedPlan.brief.daypart,
      datesConfirmed: true as const,
    },
    buyerContact: review.buyerContact,
    responseDeadline: review.responseDeadline,
    creativeCompliance: {
      status: "confirmation_required" as const,
      notes: ["Supplier to confirm artwork, production, installation, permits, and lead time"],
    },
  };
  const supplierMessages = supplierIds.map((supplierId) => {
    const supplierLines = lines.filter((line) => line.supplierId === supplierId);
    const note = review.supplierNotes[supplierId] ?? "";
    const body = [
      "DEMO — DO NOT SEND",
      campaign.product.name + " — supplier verification request",
      "Sector/objective: " + campaign.sector + " / " + campaign.objective,
      "Target audience: " + campaign.targetAudience,
      "Buyer: " + review.buyerContact.name + " <" + review.buyerContact.email + ">",
      "Response deadline: " + review.responseDeadline,
      "Confirmed flight: " + review.flightStart + " to " + review.flightEnd + " · " + campaign.flight.daypart,
      "Creative/compliance: supplier confirmation required before activation.",
      supplierLines.map(renderSupplierLine).join("\n\n"),
      note ? "Supplier note: " + note : "",
      "Please confirm identity/orientation, dimensions, availability, gross/net rate, production, installation, taxes, lead time, permits, proof of posting/play, measurement deliverables, and face-level audience provider/target/universe/period/method/uncertainty files.",
      "Status: draft, unbooked, unsent",
    ].filter(Boolean).join("\n");
    return {
      supplierId,
      supplierNote: note,
      subject: "Request for rate, availability and face verification",
      body,
      lines: supplierLines,
      watermark: "DEMO — DO NOT SEND" as const,
      status: "draft_unbooked_unsent" as const,
    };
  });
  return {
    watermark: "DEMO — DO NOT SEND",
    status: "draft_unbooked_unsent",
    supplierMessages,
    internalRequest: {
      watermark: "DEMO — DO NOT SEND",
      status: "draft_unbooked_unsent",
      planFingerprint: appliedPlan.measurement.fingerprint,
      campaign,
      internalBudget: { amount: appliedPlan.brief.budgetNgn, currency: "NGN" },
      packageCost: { amount: appliedPlan.recommended.costNgn, currency: "NGN" },
      lines,
      supplierNotes: review.supplierNotes,
      audiencePlanningBasis,
    },
  };
}

export function buildInternalDownload(rfq: RfqDraft): string {
  return canonicalJson(rfq.internalRequest) + "\n";
}
