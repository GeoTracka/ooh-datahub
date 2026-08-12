import { z } from "zod";
import type { Daypart, Objective, Sector } from "@/contracts/domain";
import type { MetricClaim, ReplayEnvelope } from "@/contracts/metrics";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const RfqReviewInputSchema = z.object({
  buyerContact: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
  }),
  responseDeadline: IsoDateSchema,
  flightStart: IsoDateSchema,
  flightEnd: IsoDateSchema,
  datesConfirmed: z.boolean(),
  supplierNotes: z.record(z.string().min(1), z.string().trim().max(2_000)).default({}),
}).superRefine((value, context) => {
  if (!value.datesConfirmed) context.addIssue({
    code: "custom", path: ["datesConfirmed"], message: "FLIGHT_DATES_NOT_CONFIRMED",
  });
  if (value.flightStart > value.flightEnd) context.addIssue({
    code: "custom", path: ["flightEnd"], message: "FLIGHT_DATE_ORDER_INVALID",
  });
  if (value.responseDeadline >= value.flightStart) context.addIssue({
    code: "custom", path: ["responseDeadline"], message: "RESPONSE_DEADLINE_TOO_LATE",
  });
});
export type RfqReviewInput = z.infer<typeof RfqReviewInputSchema>;

export type CampaignRfqFields = {
  product: { name: string; description: string };
  sector: Sector;
  objective: Objective;
  targetAudience: string;
  geography: { market: "Lagos"; zones: Array<{ id: string; label: string }> };
  flight: { start: string; end: string; daypart: Daypart; datesConfirmed: true };
  buyerContact: RfqReviewInput["buyerContact"];
  responseDeadline: string;
  creativeCompliance: {
    status: "confirmation_required";
    notes: string[];
  };
};

export type SupplierRfqLine = {
  supplierId: string;
  ownerSeller: string;
  assetId: string;
  structureId: string | null;
  faceId: string;
  address: string;
  coordinate: { longitude: number; latitude: number };
  format: string;
  dimensions: string | null;
  mediaClass: "STATIC" | "DOOH";
  requestedSchedule: {
    start: string;
    end: string;
    daypart: Daypart;
    quantity: 1;
    shareOfTimePercent: number | null;
  };
  indicativeRate: {
    amount: number;
    currency: "NGN";
    basis: "illustrative_demo_line_rate";
  };
  confirmationRequests: {
    identityAndOrientation: "REQUESTED";
    dimensions: "REQUESTED";
    availability: "REQUESTED";
    grossAndNetRate: "REQUESTED";
    production: "REQUESTED";
    installation: "REQUESTED";
    taxes: "REQUESTED";
    leadTime: "REQUESTED";
    permitOrAuthorization: "REQUESTED";
    proofOfPostingOrPlay: "REQUESTED";
    measurementDeliverables: "REQUESTED";
    faceLevelAudienceMethodFiles: "REQUESTED";
  };
};

export type RfqRange =
  | { type: "scenario"; low: number; base: number; high: number }
  | { type: "quantile"; p10: number; p50: number; p90: number };

export type AudiencePlanningBasis = {
  estimateValidity:
    | "EXACT_APPLIED_PLAN"
    | "RFQ_SCHEDULE_REQUIRES_RECOMPUTE"
    | "CONTEXT_SHORTLIST_ONLY";
  targetReach: MetricClaim | null;
  targetDefinition: string;
  targetUniverse: number | null;
  targetReachSharePercent: RfqRange | null;
  influenceCapture: MetricClaim | null;
  priorityInfluenceArchetypes: string[];
  exposureBasis: "target people with at least one modelled OOH opportunity to see";
  exposureThreshold: "1+";
  modelVersion: string;
  targetUniverseVersion: string;
  influenceProfileVersion: string | null;
  intervalType: "scenario" | "quantile" | "unavailable";
  contextRevision: {
    enrichmentSnapshotId: string;
    dataRevision: string;
    decisionUse: "context_only";
    reasonCode: string | null;
  } | null;
  evidence: { recommendation: string; reach: string; influence: string | null };
  limitations: string[];
  replay: ReplayEnvelope;
};

export type SupplierMessage = {
  supplierId: string;
  supplierNote: string;
  subject: string;
  body: string;
  lines: SupplierRfqLine[];
  watermark: "DRAFT — NOT YET SENT";
  status: "draft_unbooked_unsent";
};

export type InternalRfqRequest = {
  watermark: "DRAFT — NOT YET SENT";
  status: "draft_unbooked_unsent";
  planFingerprint: string;
  campaign: CampaignRfqFields;
  internalBudget: { amount: number; currency: "NGN" };
  packageCost: { amount: number; currency: "NGN" };
  lines: SupplierRfqLine[];
  supplierNotes: Record<string, string>;
  audiencePlanningBasis: AudiencePlanningBasis;
};

export type RfqDraft = {
  watermark: "DRAFT — NOT YET SENT";
  status: "draft_unbooked_unsent";
  supplierMessages: SupplierMessage[];
  internalRequest: InternalRfqRequest;
};

export type RfqWorkflowState =
  | { status: "Review required" }
  | { status: "Generating" }
  | { status: "Generated"; output: RfqDraft }
  | { status: "Generation failed"; message: string };
