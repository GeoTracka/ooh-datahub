export const SURVEY_CONTEXT_SCHEMA_VERSION =
  "consumer-survey-context-v2" as const;
export const SURVEY_DECISION_USE = "context_only" as const;
export const SURVEY_CLAIM_BOUNDARY =
  "self_reported_consumer_context_not_observed_delivery" as const;

export const SURVEY_FORMATS = [
  "large_billboard",
  "digital_led",
  "transit_vehicle",
  "airport",
  "street_furniture",
] as const;

export const SURVEY_FORMAT_ATTRIBUTES = [
  "attention",
  "recall",
  "trust",
  "effect",
  "quality_feel",
] as const;

export const SURVEY_FACET_DIMENSIONS = [
  "city",
  "ageBand",
  "gender",
  "occupation",
  "incomeBand",
  "transportMode",
  "commutePattern",
] as const;

export type SurveyFormat = (typeof SURVEY_FORMATS)[number];
export type SurveyFormatAttribute = (typeof SURVEY_FORMAT_ATTRIBUTES)[number];
export type SurveyFacetDimension = (typeof SURVEY_FACET_DIMENSIONS)[number];

export type SurveySourceSpec = {
  id: string;
  fileName: string;
  sha256: string;
  sheetName: string;
  expectedDataRows: number;
  expectedColumns: number;
  headerSha256: string;
  collectionPeriod: { start: string; end: string };
  authority: "solution_owner_authoritative";
  cleaningStatus: "authoritative_cleaned_final";
  commercialUse: "owner_authorized_unrestricted";
  decisionUse: typeof SURVEY_DECISION_USE;
};

export type SurveyRowDiagnosticCode =
  | "CONTEXT_SCREEN_NOT_ELIGIBLE"
  | "GPS_OUTSIDE_NIGERIA_BOUNDS"
  | "GPS_PRECISION_NONPOSITIVE"
  | "INTERVIEW_DURATION_NEGATIVE"
  | "TOP3_FORMAT_COUNT_DIAGNOSTIC"
  | "TOP2_COMMUTE_COUNT_DIAGNOSTIC"
  | "TOP2_DRIVER_COUNT_DIAGNOSTIC"
  | "RECALL_NO_WITH_FOLLOWUP"
  | "RECALL_YES_MISSING_FOLLOWUP"
  | "FORMAT_MATRIX_INCOMPLETE"
  | "FORMAT_MATRIX_STRAIGHTLINE";

export type SurveyRowDiagnostic = {
  code: SurveyRowDiagnosticCode;
  scope: "row" | "question";
  severity: "advisory";
};

export type SurveyFormatRatings = Partial<
  Record<SurveyFormat, Partial<Record<SurveyFormatAttribute, number>>>
>;

export type CanonicalSurveyResponse = {
  sourceRowNumber: number;
  contextEligible: boolean;
  collectionStart: string | null;
  collectionEnd: string | null;
  formVersion: string | null;
  city: string | null;
  ageBand: string | null;
  gender: string | null;
  occupation: string | null;
  incomeBand: string | null;
  transportMode: string | null;
  commutePattern: string | null;
  weekdayDayparts: string[];
  weekendDayparts: string[];
  oohAttention: string | null;
  weeklyNoticeFrequency: string | null;
  recalledOohLastFourWeeks: boolean | null;
  recallDetailComplete: boolean | null;
  primaryOohEnvironment: string | null;
  hardestToIgnoreFormat: string | null;
  memorabilityDriver: string | null;
  commuteMood: string | null;
  trafficAttention: string | null;
  bestRoad: string | null;
  bestArea: string | null;
  topFormats: string[];
  commuteAttentionTargets: string[];
  attentionDrivers: string[];
  actions: string[];
  responsiveCategories: string[];
  formatRatings: SurveyFormatRatings;
  diagnostics: SurveyRowDiagnostic[];
};

export type SurveyFacetScope = Partial<Record<SurveyFacetDimension, string>>;

export type SurveyAggregateMetric = {
  id: string;
  label: string;
  kind: "share" | "mean";
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  unit: "proportion" | "rating_1_to_5";
  suppressed: boolean;
  questionId: string;
  decisionUse: typeof SURVEY_DECISION_USE;
  claimBoundary: typeof SURVEY_CLAIM_BOUNDARY;
};

export type SurveyAggregateFacet = {
  scopeKey: string;
  scope: SurveyFacetScope;
  sampleSize: number;
  metrics: SurveyAggregateMetric[];
};

export type SurveyAggregateSnapshotContent = {
  schemaVersion: typeof SURVEY_CONTEXT_SCHEMA_VERSION;
  source: SurveySourceSpec;
  decisionUse: typeof SURVEY_DECISION_USE;
  claimBoundary: typeof SURVEY_CLAIM_BOUNDARY;
  minimumSampleSize: number;
  responseCount: number;
  includedResponseCount: number;
  excludedResponseCount: number;
  facetGroupings: SurveyFacetDimension[][];
  facets: SurveyAggregateFacet[];
};

export type SurveyAggregateSnapshot = SurveyAggregateSnapshotContent & {
  snapshotDigest: string;
};

export type SurveyContextQuery = SurveyFacetScope;

export type SurveyContextSignal = {
  id: string;
  label: string;
  metricLabel: string;
  valueText: string;
  evidenceSentence: string;
  sampleSize: number;
  scope: SurveyFacetScope;
  sourceId: string;
  sourcePeriod: { start: string; end: string };
  evidenceState: "authoritative_owner_supplied_survey";
  decisionUse: typeof SURVEY_DECISION_USE;
  claimBoundary: typeof SURVEY_CLAIM_BOUNDARY;
};
