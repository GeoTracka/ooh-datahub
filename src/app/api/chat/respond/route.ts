import { requireUser } from "@/server/auth/currentUser";
import { plannerEvents } from "@/server/ai/runtime";
import { getOwnedThread } from "@/server/chat/service";
import { consumeAiRateLimit } from "@/server/chat/runtimePersistence";
import { createRespondHandler } from "@/server/chat/respondHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createRespondHandler({
  requireUser,
  getOwnedThread,
  checkRateLimit: consumeAiRateLimit,
  events: plannerEvents,
});
