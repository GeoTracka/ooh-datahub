import { NextResponse } from "next/server";

import {
  requireUser,
  UnauthenticatedError,
} from "@/server/auth/currentUser";
import { CreateThreadCommandSchema } from "@/server/chat/contracts";
import { createThread, listThreads } from "@/server/chat/service";

function unauthenticated(error: unknown) {
  return error instanceof UnauthenticatedError ||
    (error instanceof Error && error.message === "UNAUTHENTICATED");
}

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ threads: await listThreads(user.id) });
  } catch (error) {
    if (unauthenticated(error)) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const command = CreateThreadCommandSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!command.success) {
      return NextResponse.json({ error: "INVALID_THREAD_COMMAND" }, { status: 400 });
    }
    return NextResponse.json(
      { thread: await createThread(user.id, command.data.title) },
      { status: 201 },
    );
  } catch (error) {
    if (unauthenticated(error)) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    throw error;
  }
}
