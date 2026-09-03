import type { z } from "zod";

import type {
  EvidenceAnswer,
  EvidenceQuery,
} from "@/server/evidence/repository";
import {
  CompareCitiesArgsSchema,
  EvidenceToolResultSchema,
  ExplainPlanMetricArgsSchema,
  GetCityProfileArgsSchema,
  GetCreativeGuidanceArgsSchema,
  GetFormatScoresArgsSchema,
  GetMobilityContextArgsSchema,
  SearchEvidenceArgsSchema,
} from "@/server/ai/tools/contracts";

export type EvidenceToolRepository = {
  search(query: EvidenceQuery): Promise<EvidenceAnswer[]>;
};

const ATTENTION_METRICS = [
  "journey_attention_high",
  "journey_attention_very_high",
  "journey_attention_moderate",
  "journey_attention_low",
  "journey_attention_none",
] as const;

const MOBILITY_METRICS = [
  "travel_frequency_daily_commuter",
  "travel_frequency_hybrid",
  "travel_frequency_remote",
  "primary_transport_private_car",
  "primary_transport_bus_or_brt",
  "primary_transport_danfo",
  "primary_transport_motorcycle",
  "primary_transport_tricycle_keke",
  "primary_transport_ride_hailing",
  "primary_transport_walking",
] as const;

const FORMAT_PRESENCE_METRICS = [
  "top_format_seen_large_billboard",
  "top_format_seen_digital_screen_or_led",
  "top_format_seen_bus_or_vehicle_wrap",
  "top_format_seen_mall_screen",
  "top_format_seen_airport_ad",
  "top_format_seen_pole_banner",
  "top_format_seen_bus_shelter_ad",
  "hardest_to_ignore_digital_led_screen",
  "hardest_to_ignore_large_static_billboard",
  "hardest_to_ignore_vehicle_wrap",
] as const;

const CREATIVE_METRICS = [
  "creative_trigger_animated_display",
  "creative_trigger_brighter_screen",
  "creative_trigger_funny_or_entertaining_content",
  "creative_trigger_influencer",
  "creative_trigger_local_language",
  "creative_trigger_relevant_to_my_life",
] as const;

const FORBIDDEN_QUERY =
  /\b(respondent|raw\s+(?:row|record|data)|gps|coordinates?|phone|email|home\s+address|open\s*text|verbatim|individual|personally\s+identifiable|absolute\s+(?:site\s+)?reach|site\s+(?:reach|delivery|frequency|impressions?)|live\s+availability|inventory\s+availability|negotiated\s+rates?|price|roi|return\s+on\s+investment|caused?|causal|book(?:ing)?|supplier\s+message|radio\s+station|outdoor\s+activation)\b/i;

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function metricsForSearch(query: string): readonly string[] {
  const normalized = query.normalize("NFKC").toLocaleLowerCase("en-NG");
  if (FORBIDDEN_QUERY.test(normalized)) throw new Error("UNSUPPORTED_EVIDENCE_QUERY");
  const matches: string[] = [];
  if (/creative|message|content|design/.test(normalized)) matches.push(...CREATIVE_METRICS);
  if (/format|billboard|digital|led|shelter|vehicle/.test(normalized)) {
    matches.push(...FORMAT_PRESENCE_METRICS);
  }
  if (/mobility|transport|travel|commut|road|move/.test(normalized)) {
    matches.push(...MOBILITY_METRICS);
  }
  if (/attention|notice|observ/.test(normalized)) matches.push(...ATTENTION_METRICS);
  if (matches.length > 0) return dedupe(matches);
  throw new Error("UNSUPPORTED_EVIDENCE_QUERY");
}

function result(summary: string, answers: EvidenceAnswer[]) {
  return EvidenceToolResultSchema.parse({
    summary,
    answers,
    limitations: [
      "These are unweighted findings from the study sample, not population reach or media delivery.",
      "Use the campaign planner for inventory-based estimates; do not treat survey responses as live availability.",
    ],
  });
}

async function search(
  repository: EvidenceToolRepository,
  metricIds: readonly string[],
  cityIds: readonly string[],
  segments?: Pick<EvidenceQuery, "ageBands" | "genders">,
) {
  const answers = await repository.search({
    metricIds: dedupe(metricIds),
    geographyIds: dedupe(cityIds),
    ...segments,
  });
  const scoped = segments?.ageBands?.length || segments?.genders?.length
    ? answers
    : answers.filter((answer) =>
        Object.keys(answer.segment).every((key) => key === "city"),
      );
  return scoped
    .sort((left, right) =>
      left.geography.localeCompare(right.geography) ||
      left.metricId.localeCompare(right.metricId),
    )
    .slice(0, 200);
}

const PROFILE_METRICS = [
  ...ATTENTION_METRICS,
  ...MOBILITY_METRICS,
  ...FORMAT_PRESENCE_METRICS,
  ...CREATIVE_METRICS,
] as const;

const FORMAT_SUFFIXES = {
  large_billboard: "large_billboard",
  digital_led_screen: "digital_led_screen",
  bus_shelter: "bus_shelter",
  vehicle_ad: "vehicle_ad",
  airport_advertising: "airport_advertising",
} as const;

const DIMENSION_PREFIXES = {
  attention: "format_attention_rating",
  recall: "format_recall_rating",
  trust: "format_trust_rating",
  effect: "format_effect_rating",
  quality: "format_quality_rating",
} as const;

const PLAN_METRIC_EXPLANATIONS = {
  possible_ad_views:
    "Possible ad views estimate opportunities for people to see the selected media, using movement, viewing direction, visible area, schedule and display availability inputs.",
  estimated_people_reached:
    "Estimated people reached adjusts possible ad views for audience relevance and repeat viewing. It is a planning estimate, not a guaranteed audience count.",
  influence_capture:
    "Influence capture shows the share of modelled opportunity retained as the plan moves through visibility, audience relevance and repeat-view adjustments.",
  planning_fit:
    "Planning fit is a comparative score based on the brief, package mix, supporting evidence and stated constraints. It is not a probability of campaign success.",
  activity_potential:
    "Activity potential describes how suitable an area may be for supported on-ground activity using available context. It does not confirm permits, suppliers or live availability.",
} as const;

export function createEvidenceTools(repository: EvidenceToolRepository) {
  return {
    async searchEvidence(input: z.input<typeof SearchEvidenceArgsSchema>) {
      const args = SearchEvidenceArgsSchema.parse(input);
      const answers = await search(
        repository,
        metricsForSearch(args.query),
        args.cityIds,
        {
          ageBands: args.ageBands ?? undefined,
          genders: args.genders ?? undefined,
        },
      );
      return result(`Found ${answers.length} governed study findings for the requested cities.`, answers);
    },
    async getCityProfile(input: z.input<typeof GetCityProfileArgsSchema>) {
      const args = GetCityProfileArgsSchema.parse(input);
      const answers = (
        await Promise.all([
          search(repository, PROFILE_METRICS.slice(0, 25), [args.cityId]),
          search(repository, PROFILE_METRICS.slice(25), [args.cityId]),
        ])
      )
        .flat()
        .sort((left, right) => left.metricId.localeCompare(right.metricId));
      return result(`Study profile for ${args.cityId.replaceAll("_", " ")}.`, answers);
    },
    async compareCities(input: z.input<typeof CompareCitiesArgsSchema>) {
      const args = CompareCitiesArgsSchema.parse(input);
      const metricIds = {
        attention: ATTENTION_METRICS,
        mobility: MOBILITY_METRICS,
        formats: FORMAT_PRESENCE_METRICS,
        creative: CREATIVE_METRICS,
      }[args.topic];
      const answers = await search(repository, metricIds, args.cityIds);
      return result(
        `Governed ${args.topic} comparison across ${args.cityIds.length} cities.`,
        answers,
      );
    },
    async getFormatScores(input: z.input<typeof GetFormatScoresArgsSchema>) {
      const args = GetFormatScoresArgsSchema.parse(input);
      const formats = args.formats ?? Object.keys(FORMAT_SUFFIXES) as Array<keyof typeof FORMAT_SUFFIXES>;
      const dimensions = args.dimensions ?? Object.keys(DIMENSION_PREFIXES) as Array<keyof typeof DIMENSION_PREFIXES>;
      const metricIds = dimensions.flatMap((dimension) =>
        formats.map(
          (format) => `${DIMENSION_PREFIXES[dimension]}_${FORMAT_SUFFIXES[format]}`,
        ),
      );
      const answers = await search(repository, metricIds, args.cityIds);
      return result("Five-point format scores from valid study responses.", answers);
    },
    async getMobilityContext(input: z.input<typeof GetMobilityContextArgsSchema>) {
      const args = GetMobilityContextArgsSchema.parse(input);
      const answers = await search(repository, MOBILITY_METRICS, args.cityIds);
      return result("Travel frequency and usual transport context from the study.", answers);
    },
    async getCreativeGuidance(input: z.input<typeof GetCreativeGuidanceArgsSchema>) {
      const args = GetCreativeGuidanceArgsSchema.parse(input);
      const answers = await search(repository, CREATIVE_METRICS, args.cityIds);
      return result("Reported creative features that may help attract attention.", answers);
    },
    async explainPlanMetric(input: z.input<typeof ExplainPlanMetricArgsSchema>) {
      const args = ExplainPlanMetricArgsSchema.parse(input);
      return EvidenceToolResultSchema.parse({
        summary: PLAN_METRIC_EXPLANATIONS[args.metric],
        answers: [],
        limitations: [
          "The explanation describes the planner method; the current plan artifact contains the applicable inputs and caveats.",
        ],
      });
    },
  };
}

export type EvidenceTools = ReturnType<typeof createEvidenceTools>;
