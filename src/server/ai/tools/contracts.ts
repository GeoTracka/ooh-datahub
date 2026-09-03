import { z } from "zod";

import { RBL_LOMA_CITY_IDS } from "@/evidence/contracts";

export const CityIdSchema = z.enum(RBL_LOMA_CITY_IDS);
export const CityIdsSchema = z.array(CityIdSchema).min(1).max(5);

export const SearchEvidenceArgsSchema = z
  .object({
    query: z.string().trim().min(2).max(240),
    cityIds: CityIdsSchema,
    ageBands: z.array(z.string().trim().min(1).max(48)).max(8).optional(),
    genders: z.array(z.string().trim().min(1).max(48)).max(8).optional(),
  })
  .strict();

export const GetCityProfileArgsSchema = z
  .object({ cityId: CityIdSchema })
  .strict();

export const CompareCitiesArgsSchema = z
  .object({
    cityIds: z.array(CityIdSchema).min(2).max(5),
    topic: z.enum(["attention", "mobility", "formats", "creative"]),
  })
  .strict();

export const GetFormatScoresArgsSchema = z
  .object({
    cityIds: CityIdsSchema,
    formats: z
      .array(
        z.enum([
          "large_billboard",
          "digital_led_screen",
          "bus_shelter",
          "vehicle_ad",
          "airport_advertising",
        ]),
      )
      .min(1)
      .max(5)
      .optional(),
    dimensions: z
      .array(z.enum(["attention", "recall", "trust", "effect", "quality"]))
      .min(1)
      .max(5)
      .optional(),
  })
  .strict();

export const GetMobilityContextArgsSchema = z
  .object({ cityIds: CityIdsSchema })
  .strict();

export const GetCreativeGuidanceArgsSchema = z
  .object({ cityIds: CityIdsSchema })
  .strict();

export const ExplainPlanMetricArgsSchema = z
  .object({
    metric: z.enum([
      "possible_ad_views",
      "estimated_people_reached",
      "influence_capture",
      "planning_fit",
      "activity_potential",
    ]),
  })
  .strict();

export const EvidenceAnswerSchema = z
  .object({
    factId: z.string().min(1),
    metricId: z.string().min(1),
    label: z.string().min(1),
    value: z.number().finite(),
    unit: z.enum(["percent", "mean_1_5", "respondents"]),
    numerator: z.number().int().nonnegative().nullable(),
    denominator: z.number().int().positive().nullable(),
    respondentBase: z.number().int().min(30),
    geography: CityIdSchema,
    segment: z.record(z.string(), z.string()),
    period: z.string().min(1),
    caveat: z.string().min(1),
    citation: z
      .object({
        sourceId: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        workbookField: z.string().nullable(),
        page: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export const EvidenceToolResultSchema = z
  .object({
    summary: z.string().min(1).max(600),
    answers: z.array(EvidenceAnswerSchema).max(200),
    limitations: z.array(z.string().min(1).max(300)).max(5),
  })
  .strict();

export type EvidenceToolResult = z.infer<typeof EvidenceToolResultSchema>;
