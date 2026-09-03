import { RBL_LOMA_CITY_IDS } from "@/evidence/contracts";

export const APPROVED_METRIC_FAMILIES = [
  "sample_base",
  "journey_attention",
  "travel_frequency",
  "primary_transport",
  "weekday_time",
  "weekly_environment",
  "noticed_frequency",
  "top_format_seen",
  "hardest_to_ignore",
  "commute_mood",
  "commute_attention",
  "format_attention_rating",
  "format_recall_rating",
  "format_trust_rating",
  "format_effect_rating",
  "format_quality_rating",
  "creative_trigger",
  "reported_post_ad_action",
] as const;

const UNSUPPORTED_METRIC_PREFIXES = [
  "population_extrapolation",
  "site_reach",
  "frequency",
  "price",
  "availability",
  "roi",
  "radio",
  "outdoor_activation",
] as const;

export type EvidenceDisposition =
  | { status: "approved" }
  | {
      status: "blocked";
      reason:
        | "workbook_report_mismatch"
        | "unsupported_metric"
        | "unknown_metric"
        | "unsupported_geography";
    };

function belongsToFamily(metricId: string, family: string): boolean {
  return metricId === family || metricId.startsWith(`${family}_`);
}

export function evidenceDisposition(
  metricId: string,
  geography: string,
): EvidenceDisposition {
  if (!RBL_LOMA_CITY_IDS.some((city) => city === geography)) {
    return { status: "blocked", reason: "unsupported_geography" };
  }

  if (belongsToFamily(metricId, "four_week_recall")) {
    return { status: "blocked", reason: "workbook_report_mismatch" };
  }

  if (
    UNSUPPORTED_METRIC_PREFIXES.some((prefix) =>
      belongsToFamily(metricId, prefix),
    )
  ) {
    return { status: "blocked", reason: "unsupported_metric" };
  }

  if (
    APPROVED_METRIC_FAMILIES.some((family) =>
      belongsToFamily(metricId, family),
    )
  ) {
    return { status: "approved" };
  }

  return { status: "blocked", reason: "unknown_metric" };
}
