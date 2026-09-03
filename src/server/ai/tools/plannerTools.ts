import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  buildPlan,
  recalculatePlan,
  recalculateSelectedSites,
  replaceZoneWithZone,
} from "@/application/plannerService";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { DaypartSchema } from "@/contracts/domain";
import {
  ArtifactPayloadSchema,
  BriefSchema,
  type ArtifactPayload,
} from "@/server/artifacts/contracts";
import { presentCampaignPlan } from "@/server/ai/tools/planPresentation";

export const PlanChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("budget"), budgetNgn: z.number().int().positive().max(10_000_000_000) }).strict(),
  z.object({ kind: z.literal("dates"), flightStart: z.iso.date(), flightEnd: z.iso.date() }).strict(),
  z.object({ kind: z.literal("daypart"), daypart: DaypartSchema }).strict(),
  z.object({ kind: z.literal("selected_sites"), siteIds: z.array(z.string().min(1)).min(1).max(50) }).strict(),
  z.object({ kind: z.literal("replace_zone"), removeZoneId: z.string().min(1), addZoneId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("selected_option"), optionId: z.string().min(1) }).strict(),
]);

export type PlanChange = z.infer<typeof PlanChangeSchema>;

export const PlanChangeToolSchema = z
  .object({
    kind: z.enum([
      "budget",
      "dates",
      "daypart",
      "selected_sites",
      "replace_zone",
      "selected_option",
    ]),
    budgetNgn: z.number().int().positive().max(10_000_000_000).nullable(),
    flightStart: z.iso.date().nullable(),
    flightEnd: z.iso.date().nullable(),
    daypart: DaypartSchema.nullable(),
    siteIds: z.array(z.string().min(1)).min(1).max(50).nullable(),
    removeZoneId: z.string().min(1).nullable(),
    addZoneId: z.string().min(1).nullable(),
    optionId: z.string().min(1).nullable(),
  })
  .strict();

export function parsePlanChangeToolInput(input: unknown): PlanChange {
  const change = PlanChangeToolSchema.parse(input);
  switch (change.kind) {
    case "budget":
      return PlanChangeSchema.parse({ kind: change.kind, budgetNgn: change.budgetNgn });
    case "dates":
      return PlanChangeSchema.parse({
        kind: change.kind,
        flightStart: change.flightStart,
        flightEnd: change.flightEnd,
      });
    case "daypart":
      return PlanChangeSchema.parse({ kind: change.kind, daypart: change.daypart });
    case "selected_sites":
      return PlanChangeSchema.parse({ kind: change.kind, siteIds: change.siteIds });
    case "replace_zone":
      return PlanChangeSchema.parse({
        kind: change.kind,
        removeZoneId: change.removeZoneId,
        addZoneId: change.addZoneId,
      });
    case "selected_option":
      return PlanChangeSchema.parse({ kind: change.kind, optionId: change.optionId });
  }
}

export async function buildCampaignPlan(input: unknown) {
  const brief = BriefSchema.parse(input);
  return presentCampaignPlan(buildPlan(frozenLagosBundle, brief));
}

function planPayload(payload: ArtifactPayload) {
  if (payload.type !== "plan") throw new Error("PLAN_ARTIFACT_REQUIRED");
  return payload;
}

function selectedCandidate(payload: ReturnType<typeof planPayload>) {
  const option = payload.selectedOptionId
    ? payload.options.find((candidate) => candidate.id === payload.selectedOptionId)
    : payload.options[0];
  if (!option) throw new Error("PLAN_OPTION_NOT_FOUND");
  return option.candidate;
}

export function adjustCampaignPlan(payloadInput: unknown, changeInput: unknown) {
  const payload = planPayload(ArtifactPayloadSchema.parse(payloadInput));
  const change = PlanChangeSchema.parse(changeInput);
  if (change.kind === "selected_option") {
    if (!payload.options.some((option) => option.id === change.optionId)) {
      throw new Error("PLAN_OPTION_NOT_FOUND");
    }
    return { ...payload, selectedOptionId: change.optionId };
  }

  let basis = buildPlan(frozenLagosBundle, payload.brief);
  const selected = selectedCandidate(payload);
  if (selected.id !== basis.recommended.id) {
    basis = recalculateSelectedSites(frozenLagosBundle, basis, selected.siteIds);
  }

  const revised = (() => {
    switch (change.kind) {
      case "budget":
        return recalculatePlan(frozenLagosBundle, basis, { budgetNgn: change.budgetNgn });
      case "dates":
        if (change.flightStart > change.flightEnd) throw new Error("INVALID_FLIGHT_DATES");
        return recalculatePlan(frozenLagosBundle, basis, {
          flightStart: change.flightStart,
          flightEnd: change.flightEnd,
        });
      case "daypart":
        return recalculatePlan(frozenLagosBundle, basis, { daypart: change.daypart });
      case "selected_sites":
        return recalculateSelectedSites(frozenLagosBundle, basis, dedupe(change.siteIds));
      case "replace_zone":
        return replaceZoneWithZone(
          frozenLagosBundle,
          basis,
          change.removeZoneId,
          change.addZoneId,
        );
    }
  })();
  return presentCampaignPlan(revised);
}

function dedupe(values: readonly string[]) {
  return [...new Set(values)];
}

export function getPlanMap(payloadInput: unknown, planRevision: number) {
  const payload = planPayload(ArtifactPayloadSchema.parse(payloadInput));
  const candidate = selectedCandidate(payload);
  return ArtifactPayloadSchema.parse({
    type: "map",
    version: 1,
    planRevision: z.number().int().positive().parse(planRevision),
    zoneIds: candidate.zoneIds,
    siteIds: candidate.siteIds,
    selectedFeatureId: null,
  });
}

type HandoffClaims = {
  artifactId: string;
  revision: number;
  userId: string;
  expiresAt: number;
};

function handoffSecret(): string {
  const secret = process.env.SESSION_COOKIE_SECRET?.trim();
  if (!secret) throw new Error("SESSION_COOKIE_SECRET_REQUIRED");
  return secret;
}

export function createVisualPlannerHandoff(
  input: Omit<HandoffClaims, "expiresAt">,
  now = new Date(),
) {
  const claims: HandoffClaims = {
    ...input,
    revision: z.number().int().positive().parse(input.revision),
    expiresAt: now.getTime() + 5 * 60 * 1_000,
  };
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", handoffSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyVisualPlannerHandoff(token: string, now = new Date()): HandoffClaims {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("INVALID_HANDOFF_TOKEN");
  const expected = createHmac("sha256", handoffSecret()).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("INVALID_HANDOFF_TOKEN");
  }
  const claims = z
    .object({
      artifactId: z.string().min(1),
      revision: z.number().int().positive(),
      userId: z.string().min(1),
      expiresAt: z.number().int().positive(),
    })
    .strict()
    .parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  if (claims.expiresAt <= now.getTime()) throw new Error("EXPIRED_HANDOFF_TOKEN");
  return claims;
}
