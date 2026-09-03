import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireUser,
  UnauthenticatedError,
} from "@/server/auth/currentUser";
import { RenameThreadCommandSchema } from "@/server/chat/contracts";
import {
  deleteThread,
  getOwnedThread,
  listMessages,
  renameThread,
} from "@/server/chat/service";

const ThreadIdSchema = z.string().uuid();

async function ownedParams(
  context: RouteContext<"/api/chat/threads/[threadId]">,
) {
  const { threadId } = await context.params;
  return ThreadIdSchema.parse(threadId);
}

function routeError(error: unknown) {
  if (
    error instanceof UnauthenticatedError ||
    (error instanceof Error && error.message === "UNAUTHENTICATED")
  ) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (
    (error instanceof Error && error.message === "THREAD_NOT_FOUND") ||
    error instanceof z.ZodError
  ) {
    return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }
  throw error;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/chat/threads/[threadId]">,
) {
  try {
    const user = await requireUser();
    const threadId = await ownedParams(context);
    return NextResponse.json({
      thread: await getOwnedThread(threadId, user.id),
      messages: await listMessages(threadId, user.id),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/chat/threads/[threadId]">,
) {
  try {
    const user = await requireUser();
    const threadId = await ownedParams(context);
    const command = RenameThreadCommandSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!command.success) {
      return NextResponse.json({ error: "INVALID_THREAD_COMMAND" }, { status: 400 });
    }
    return NextResponse.json({
      thread: await renameThread(threadId, user.id, command.data.title),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/chat/threads/[threadId]">,
) {
  try {
    const user = await requireUser();
    const threadId = await ownedParams(context);
    await deleteThread(threadId, user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
