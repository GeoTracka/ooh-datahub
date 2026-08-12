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
import { PUBLIC_COPY } from "@/content/plainLanguage";

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
  const timeLabel = ({
    all_day: "All day",
    am: "Morning",
    midday: "Midday",
    pm: "Afternoon",
    evening: "Evening",
  } as const)[line.requestedSchedule.daypart];
  return [
    "Media location reference: " + line.assetId,
    "Address and coordinates: " + line.address + " / " +
      line.coordinate.latitude + ", " + line.coordinate.longitude,
    "Format and size: " + line.format + " / " +
      (line.mediaClass === "DOOH" ? "Digital" : "Static") + " / " +
      (line.dimensions ?? "Confirmation requested"),
    "Campaign dates: " + line.requestedSchedule.start + " to " +
      line.requestedSchedule.end + " / " + timeLabel +
      " / " + line.requestedSchedule.quantity + " placement" +
      (line.requestedSchedule.quantity === 1 ? "" : "s") + " / display time " +
      (line.requestedSchedule.shareOfTimePercent === null
        ? "Confirmation requested"
        : line.requestedSchedule.shareOfTimePercent + "%"),
    "Current planning rate: NGN " + line.indicativeRate.amount,
    "Please confirm the location details, availability, final price, installation, approvals, and proof of display.",
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
      basis: "indicative_planning_rate",
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
    exposureBasis: "people in the chosen audience who may see the campaign at least once",
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
    } : null,
    evidence: {
      recommendation: appliedPlan.recommended.evidenceGrade,
      reach: appliedPlan.measurement.evidence.uniqueReach?.grade ?? "unavailable",
      influence: appliedPlan.measurement.evidence.influence?.grade ?? null,
    },
    limitations: [
      ...appliedPlan.measurement.claim.caveats,
      ...(changedSchedule ? ["The reviewed campaign dates changed; update audience estimates before using them."] : []),
      ...(contextOnly ? ["Audience estimates are unavailable; inventory is included for comparison only."] : []),
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
      PUBLIC_COPY.rfq.watermark,
      campaign.product.name + " — supplier request",
      "Campaign type: " + ({ fmcg: "Consumer goods", real_estate: "Real Estate", bank_fintech: "Bank / Fintech" } as const)[campaign.sector],
      "Campaign goal: " + ({ broad_reach: "Broad reach", influential_core: "Priority audience", near_conversion: "Likely customers" } as const)[campaign.objective],
      "Target audience: " + campaign.targetAudience,
      "Buyer: " + review.buyerContact.name + " <" + review.buyerContact.email + ">",
      "Response deadline: " + review.responseDeadline,
      "Campaign dates: " + review.flightStart + " to " + review.flightEnd + " · " + ({ all_day: "All day", am: "Morning", midday: "Midday", pm: "Afternoon", evening: "Evening" } as const)[campaign.flight.daypart],
      "Artwork and approvals: supplier confirmation required before the campaign starts.",
      supplierLines.map(renderSupplierLine).join("\n\n"),
      note ? "Supplier note: " + note : "",
      "Please confirm each media location, its viewing direction and size, availability, final price, production and installation costs, taxes, lead time, permits, proof of display, and any audience measurement files available for the location.",
      "Status: " + PUBLIC_COPY.rfq.status,
    ].filter(Boolean).join("\n");
    return {
      supplierId,
      supplierNote: note,
      subject: PUBLIC_COPY.rfq.subject,
      body,
      lines: supplierLines,
      watermark: PUBLIC_COPY.rfq.watermark,
      status: "draft_unbooked_unsent" as const,
    };
  });
  return {
    watermark: PUBLIC_COPY.rfq.watermark,
    status: "draft_unbooked_unsent",
    supplierMessages,
    internalRequest: {
      watermark: PUBLIC_COPY.rfq.watermark,
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
