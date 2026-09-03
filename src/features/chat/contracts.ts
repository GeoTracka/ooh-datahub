import type { ArtifactPayload } from "@/server/artifacts/contracts";
import type { PlanArtifactPayload } from "@/server/artifacts/contracts";
import type { ChatThread, MessageContent } from "@/server/chat/contracts";

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: MessageContent;
  createdAt?: Date | string;
};

export type WorkspaceArtifact = {
  id: string;
  revision: number;
  saveState: "draft" | "saved";
  payload: ArtifactPayload;
  reason: string;
  createdAt: Date | string;
};

export type PlanWorkspaceArtifact = Omit<WorkspaceArtifact, "payload"> & {
  payload: PlanArtifactPayload;
};

export type WorkspaceThread = ChatThread;
