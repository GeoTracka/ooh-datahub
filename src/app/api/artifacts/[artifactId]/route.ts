import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireUser,
  UnauthenticatedError,
} from "@/server/auth/currentUser";
import { getCurrentArtifact } from "@/server/artifacts/service";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/artifacts/[artifactId]">,
) {
  try {
    const user = await requireUser();
    const { artifactId } = await context.params;
    const id = z.string().uuid().parse(artifactId);
    return NextResponse.json({ artifact: await getCurrentArtifact(id, user.id) });
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
    throw error;
  }
}
