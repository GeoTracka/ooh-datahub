import { z } from "zod";

import {
  DaypartSchema,
  ObjectiveSchema,
  SectorSchema,
} from "@/contracts/domain";
import type { PackageCandidate } from "@/contracts/domain";

export const BriefSchema = z
  .object({
    productName: z.string().trim().min(1).max(120),
    productDescription: z.string().trim().min(1).max(2_000),
    targetAudience: z.string().trim().min(1).max(1_000),
    sector: SectorSchema,
    objective: ObjectiveSchema,
    daypart: DaypartSchema,
    budgetNgn: z.number().int().positive().max(10_000_000_000),
    normalizationBudgetNgn: z.number().int().positive().max(10_000_000_000),
    flightStart: z.iso.date(),
    flightEnd: z.iso.date(),
  })
  .refine((brief) => brief.flightStart <= brief.flightEnd, {
    message: "Flight end must not be before flight start",
    path: ["flightEnd"],
  });

export const PlanOptionSchema = z.object({
  id: z.string().min(1),
  style: z.enum(["best_overall", "maximum_delivery", "budget_smart"]),
  title: z.enum(["Balanced plan", "Highest delivery", "Budget-smart plan"]),
  candidate: z.custom<PackageCandidate>(
    (value) => Boolean(value && typeof value === "object" && "id" in value),
  ),
  tradeoffs: z.array(z.string().min(1)).min(1),
});

export const ArtifactPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("plan"),
    version: z.literal(1),
    brief: BriefSchema,
    options: z.array(PlanOptionSchema).length(3),
    selectedOptionId: z.string().nullable(),
    assumptions: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  z.object({
    type: z.literal("map"),
    version: z.literal(1),
    planRevision: z.number().int().positive(),
    zoneIds: z.array(z.string()),
    siteIds: z.array(z.string()),
    selectedFeatureId: z.string().nullable(),
  }),
  z.object({
    type: z.literal("audience"),
    version: z.literal(1),
    factIds: z.array(z.string()),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("evidence"),
    version: z.literal(1),
    factIds: z.array(z.string()),
    excerptIds: z.array(z.string()),
  }),
]);

export type ArtifactPayload = z.infer<typeof ArtifactPayloadSchema>;
export type ArtifactType = ArtifactPayload["type"];

