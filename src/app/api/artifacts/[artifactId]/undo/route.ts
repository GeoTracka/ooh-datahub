import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireUser,
  UnauthenticatedError,
} from "@/server/auth/currentUser";
import { undoArtifact } from "@/server/artifacts/service";

const UndoCommandSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();

export async function POST(
  request: Request,
  context: RouteContext<"/api/artifacts/[artifactId]/undo">,
) {
  try {
    const user = await requireUser();
    const { artifactId } = await context.params;
    const id = z.string().uuid().parse(artifactId);
    const command = UndoCommandSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!command.success) {
      return NextResponse.json({ error: "INVALID_UNDO_COMMAND" }, { status: 400 });
    }
    return NextResponse.json({
      artifact: await undoArtifact(id, user.id, command.data.expectedRevision),
    });
  } catch (error) {
    if (
      error instanceof UnauthenticatedError ||
      (error instanceof Error && error.message === "UNAUTHENTICATED")
    ) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (
      error instanceof z.ZodError ||
      (error instanceof Error && error.message === "ARTIFACT_NOT_FOUND")
    ) {
      return NextResponse.json({ error: "ARTIFACT_NOT_FOUND" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message.startsWith("STALE_ARTIFACT_REVISION") ||
        error.message === "NO_ARTIFACT_REVISION_TO_UNDO")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
