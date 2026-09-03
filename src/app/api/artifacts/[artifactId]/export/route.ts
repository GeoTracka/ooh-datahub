import { requireUser } from "@/server/auth/currentUser";
import { getCurrentArtifact } from "@/server/artifacts/service";
import { getApprovedEvidenceAnswersByIds } from "@/server/evidence/repository";
import { createArtifactExportHandler } from "@/server/exports/routeHandler";

export const runtime = "nodejs";

const handleExport = createArtifactExportHandler({
  requireUser,
  getArtifact: getCurrentArtifact,
  getEvidence: getApprovedEvidenceAnswersByIds,
});

export async function GET(
  request: Request,
  context: RouteContext<"/api/artifacts/[artifactId]/export">,
) {
  const { artifactId } = await context.params;
  return handleExport(request, artifactId);
}
