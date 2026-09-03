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

