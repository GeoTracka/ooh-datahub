import { z } from "zod";

export const DownloadDescriptorSchema = z
  .object({
    artifactId: z.string().uuid(),
    revision: z.number().int().positive(),
    reportKind: z.enum(["campaign_plan", "evidence_report"]),
    title: z.string().trim().min(1).max(160),
    filename: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    formats: z.tuple([z.literal("xlsx"), z.literal("csv")]),
  })
  .strict();

export type DownloadDescriptor = z.infer<typeof DownloadDescriptorSchema>;

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
  DownloadDescriptorSchema.extend({ type: z.literal("download_ref") }).strict(),
]);

export const MessageContentSchema = z.array(MessageContentBlockSchema).max(100);
export type MessageContent = z.infer<typeof MessageContentSchema>;

export function providerContentFromMessage(content: MessageContent) {
  return content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "artifact_ref") {
        return `[Plan artifact ${block.artifactId}, revision ${block.revision}]`;
      }
      if (block.type === "citation_ref") return `[Evidence fact ${block.factId}]`;
      const label = block.reportKind === "campaign_plan" ? "Campaign plan" : "Evidence";
      return `[${label} report ${block.artifactId}, revision ${block.revision}, available as XLSX and CSV]`;
    })
    .join("\n");
}

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
      type: z.literal("download.ready"),
      download: DownloadDescriptorSchema,
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

export const CreateThreadCommandSchema = z
  .object({ title: z.string().trim().min(1).max(80).default("New campaign") })
  .strict();

export const RenameThreadCommandSchema = z
  .object({ title: z.string().trim().min(1).max(80) })
  .strict();

export const RespondCommandSchema = z
  .object({
    threadId: z.string().uuid(),
    message: z.string().trim().min(1).max(20_000),
  })
  .strict();
