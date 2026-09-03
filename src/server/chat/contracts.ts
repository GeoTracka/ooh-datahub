import { z } from "zod";

export const MessageContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(50_000) }),
  z.object({
    type: z.literal("artifact_ref"),
    artifactId: z.string().min(1),
    revision: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("citation_ref"),
    factId: z.string().min(1),
  }),
]);

export const MessageContentSchema = z.array(MessageContentBlockSchema).max(100);
export type MessageContent = z.infer<typeof MessageContentSchema>;

export type ChatThread = {
  id: string;
  ownerId: string;
  title: string;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

export const ChatServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("response.started"), messageId: z.string() }).strict(),
  z.object({ type: z.literal("text.delta"), delta: z.string() }).strict(),
  z
    .object({
      type: z.literal("tool.started"),
      runId: z.string(),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("tool.completed"),
      runId: z.string(),
      durationMs: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("artifact.created"),
      artifactId: z.string(),
      artifactType: z.enum(["plan", "map", "audience", "evidence"]),
      revision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("response.failed"),
      code: z.string(),
      recoverable: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("response.completed"),
      messageId: z.string(),
      suggestedActions: z.array(z.string()).max(3),
    })
    .strict(),
]);

export type ChatServerEvent = z.infer<typeof ChatServerEventSchema>;
