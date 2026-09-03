import "server-only";

import { z } from "zod";

import {
  appendArtifactRevision,
  createArtifact,
  getCurrentArtifact,
  setArtifactSaveState,
} from "@/server/artifacts/service";
import { BriefSchema } from "@/server/artifacts/contracts";
import { runPlannerResponse } from "@/server/ai/orchestrator";
import { createOpenAiPlannerProvider } from "@/server/ai/openaiClient";
import {
  PlanChangeSchema,
  adjustCampaignPlan,
  buildCampaignPlan,
  createVisualPlannerHandoff,
  getPlanMap,
} from "@/server/ai/tools/plannerTools";
import { createEvidenceTools } from "@/server/ai/tools/evidenceTools";
import { createEvidenceToolRegistry } from "@/server/ai/tools/registry";
import { providerHistory } from "@/server/chat/service";
import { createMariaDbRuntimePersistence } from "@/server/chat/runtimePersistence";
import { createMariaDbEvidenceRepository } from "@/server/evidence/repository";
import type { CurrentUser } from "@/server/auth/currentUser";

const ArtifactReferenceSchema = z
  .object({ artifactId: z.string().uuid(), expectedRevision: z.number().int().positive() })
  .strict();
const AdjustPlanArgsSchema = ArtifactReferenceSchema.extend({ change: PlanChangeSchema });
const GetPlanMapArgsSchema = ArtifactReferenceSchema;
const SavePlanArgsSchema = ArtifactReferenceSchema.extend({ save: z.boolean() });
const OpenPlannerArgsSchema = ArtifactReferenceSchema;

function definition(name: string, description: string, schema: z.ZodType) {
  return {
    type: "function" as const,
    name,
    description,
    parameters: z.toJSONSchema(schema) as Record<string, unknown>,
    strict: true as const,
  };
}

function runtimeConfig() {
  const toolCalls = Number.parseInt(process.env.AI_TOOL_CALLS_PER_RESPONSE ?? "12", 10);
  return {
    maxToolCalls: Number.isInteger(toolCalls) && toolCalls > 0 ? Math.min(toolCalls, 12) : 12,
    maxProviderTurns: 6,
    toolTimeoutMs: 20_000,
  };
}

function changeReason(change: z.infer<typeof PlanChangeSchema>) {
  return {
    budget: "Update campaign budget",
    dates: "Update campaign dates",
    daypart: "Update campaign time of day",
    selected_sites: "Update selected media locations",
    replace_zone: "Replace a campaign area",
    selected_option: "Select a planning approach",
  }[change.kind];
}

export function createRuntimeToolRegistry(user: CurrentUser, threadId: string) {
  const evidence = createEvidenceToolRegistry(
    createEvidenceTools(createMariaDbEvidenceRepository()),
  );
  const plannerDefinitions = [
    definition(
      "build_campaign_plan",
      "Build exactly three distinct outdoor campaign approaches from a complete brief.",
      BriefSchema,
    ),
    definition(
      "adjust_campaign_plan",
      "Fine-tune one bounded part of an existing plan revision.",
      AdjustPlanArgsSchema,
    ),
    definition(
      "get_plan_map",
      "Create map state from the real zone and media location IDs in a plan.",
      GetPlanMapArgsSchema,
    ),
    definition(
      "save_plan",
      "Mark an owned plan as saved or return it to draft state.",
      SavePlanArgsSchema,
    ),
    definition(
      "open_visual_planner",
      "Create a short-lived link that opens this exact plan revision in the visual planner.",
      OpenPlannerArgsSchema,
    ),
  ];

  return {
    definitions: [...evidence.definitions, ...plannerDefinitions],
    async execute(name: string, argumentsJson: string) {
      if (evidence.byName.has(name)) {
        const output = await evidence.execute(name, argumentsJson);
        const answers =
          output && typeof output === "object" && "answers" in output && Array.isArray(output.answers)
            ? output.answers
            : [];
        if (answers.length === 0) return { output };
        const artifact = await createArtifact({
          ownerId: user.id,
          threadId,
          payload: {
            type: "evidence",
            version: 1,
            factIds: answers
              .map((answer) =>
                answer && typeof answer === "object" && "factId" in answer
                  ? String(answer.factId)
                  : "",
              )
              .filter(Boolean),
            excerptIds: [],
          },
          reason: `Create evidence from ${name}`,
        });
        return {
          output,
          artifact: { id: artifact.id, type: artifact.type, revision: artifact.revision },
        };
      }

      const parsed: unknown = JSON.parse(argumentsJson);
      if (name === "build_campaign_plan") {
        const payload = await buildCampaignPlan(BriefSchema.parse(parsed));
        const artifact = await createArtifact({
          ownerId: user.id,
          threadId,
          payload,
          reason: "Create campaign plan",
        });
        return {
          output: payload,
          artifact: { id: artifact.id, type: artifact.type, revision: artifact.revision },
        };
      }
      if (name === "adjust_campaign_plan") {
        const args = AdjustPlanArgsSchema.parse(parsed);
        const current = await getCurrentArtifact(args.artifactId, user.id);
        if (current.revision !== args.expectedRevision) {
          throw new Error(`STALE_ARTIFACT_REVISION:${current.revision}:${args.expectedRevision}`);
        }
        const payload = adjustCampaignPlan(current.payload, args.change);
        const revision = await appendArtifactRevision({
          artifactId: args.artifactId,
          ownerId: user.id,
          expectedParentRevision: args.expectedRevision,
          payload,
          reason: changeReason(args.change),
        });
        return {
          output: payload,
          artifact: { id: args.artifactId, type: payload.type, revision: revision.revision },
        };
      }
      if (name === "get_plan_map") {
        const args = GetPlanMapArgsSchema.parse(parsed);
        const current = await getCurrentArtifact(args.artifactId, user.id);
        if (current.revision !== args.expectedRevision) {
          throw new Error(`STALE_ARTIFACT_REVISION:${current.revision}:${args.expectedRevision}`);
        }
        const payload = getPlanMap(current.payload, current.revision);
        const artifact = await createArtifact({
          ownerId: user.id,
          threadId,
          payload,
          reason: "Create plan map",
        });
        return {
          output: payload,
          artifact: { id: artifact.id, type: artifact.type, revision: artifact.revision },
        };
      }
      if (name === "save_plan") {
        const args = SavePlanArgsSchema.parse(parsed);
        const current = await getCurrentArtifact(args.artifactId, user.id);
        if (current.revision !== args.expectedRevision) {
          throw new Error(`STALE_ARTIFACT_REVISION:${current.revision}:${args.expectedRevision}`);
        }
        return {
          output: await setArtifactSaveState(
            args.artifactId,
            user.id,
            args.save ? "saved" : "draft",
          ),
        };
      }
      if (name === "open_visual_planner") {
        const args = OpenPlannerArgsSchema.parse(parsed);
        const current = await getCurrentArtifact(args.artifactId, user.id);
        if (current.revision !== args.expectedRevision) {
          throw new Error(`STALE_ARTIFACT_REVISION:${current.revision}:${args.expectedRevision}`);
        }
        const handoff = createVisualPlannerHandoff({
          artifactId: args.artifactId,
          revision: args.expectedRevision,
          userId: user.id,
        });
        const origin = process.env.APP_ORIGIN?.trim() || "http://localhost:3000";
        return {
          output: {
            url: `${origin}/planner?handoff=${encodeURIComponent(handoff)}`,
            expiresInSeconds: 300,
          },
        };
      }
      throw new Error(`UNKNOWN_TOOL:${name}`);
    },
  };
}

export async function* plannerEvents(input: {
  user: CurrentUser;
  threadId: string;
  message: string;
  signal: AbortSignal;
}) {
  yield* runPlannerResponse(createOpenAiPlannerProvider(), {
    threadId: input.threadId,
    user: input.user,
    text: input.message,
    history: await providerHistory(input.threadId, input.user.id),
    toolRegistry: createRuntimeToolRegistry(input.user, input.threadId),
    persistence: createMariaDbRuntimePersistence(),
    config: runtimeConfig(),
    signal: input.signal,
  });
}
