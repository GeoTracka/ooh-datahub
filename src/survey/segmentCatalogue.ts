import type {
  SurveyContextQuery,
  SurveyFacetDimension,
} from "@/survey/contracts";
import type { SurveyPlanningObjective } from "@/survey/contextSignals";
import type { SurveyPlanningContextArtifact } from "@/survey/publishedContext";

export const SURVEY_SEGMENT_CATALOGUE_SCHEMA_VERSION =
  "consumer-survey-segment-catalogue-v1" as const;

export const SURVEY_SEGMENT_DIMENSIONS = [
  "ageBand",
  "occupation",
  "incomeBand",
  "transportMode",
  "commutePattern",
] as const satisfies readonly SurveyFacetDimension[];

export type SurveySegmentDimension = (typeof SURVEY_SEGMENT_DIMENSIONS)[number];

export type SurveySegmentProfile = {
  id: string;
  dimension: SurveySegmentDimension;
  value: string;
  label: string;
  predicateLabel: string;
  query: SurveyContextQuery;
  sampleSize: number;
  artifacts: Record<SurveyPlanningObjective, SurveyPlanningContextArtifact>;
};

export type SurveySegmentCatalogueContent = {
  schemaVersion: typeof SURVEY_SEGMENT_CATALOGUE_SCHEMA_VERSION;
  sourceId: string;
  sourceArtifactSha256: string;
  sourceSnapshotDigest: string;
  sourcePeriod: { start: string; end: string };
  city: string;
  minimumSampleSize: number;
  weightingState: "unweighted_descriptive";
  qualityState: "owner_approved_cleaned_with_advisory_diagnostics";
  decisionUse: "context_only";
  claimBoundary: "self_reported_consumer_context_not_observed_delivery";
  profiles: SurveySegmentProfile[];
};

export type SurveySegmentCatalogue = SurveySegmentCatalogueContent & {
  catalogueDigest: string;
};

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function surveySegmentProfileId(
  dimension: SurveySegmentDimension,
  value: string,
): string {
  return `${dimension}:${slug(value)}`;
}

export function surveySegmentLabel(
  dimension: SurveySegmentDimension,
  value: string,
): string {
  if (dimension === "ageBand") return `Aged ${value.replace("-", "–")}`;
  if (dimension === "occupation") {
    if (value === "Business/trader") return "Business owners and traders";
    if (value === "Employed professional") return "Employed professionals";
    if (value === "Artisan/skilled worker")
      return "Artisans and skilled workers";
    if (value === "Student") return "Students";
    return value;
  }
  if (dimension === "incomeBand") return `Monthly income ${value}`;
  if (dimension === "transportMode") {
    if (value === "Bus or BRT") return "Bus or BRT users";
    if (value === "Danfo") return "Danfo users";
    if (value === "Private car") return "Private-car users";
    if (value === "tricycle (Keke)") return "Keke users";
    return `${value} users`;
  }
  if (value === "Daily commuter") return "Daily commuters";
  if (value === "Hybrid") return "Hybrid commuters";
  if (value === "Remote") return "Remote workers";
  return value;
}

export function surveySegmentPredicateLabel(
  dimension: SurveySegmentDimension,
  value: string,
): string {
  const dimensionLabel: Record<SurveySegmentDimension, string> = {
    ageBand: "Age band",
    occupation: "Occupation",
    incomeBand: "Monthly income",
    transportMode: "Primary transport",
    commutePattern: "Mobility pattern",
  };
  return `${dimensionLabel[dimension]} = ${value}`;
}
