import { z } from "zod";

import { prepareArtifactExport } from "@/server/ai/tools/exportTools";
import type { ArtifactPayload } from "@/server/artifacts/contracts";
import type { CurrentUser } from "@/server/auth/currentUser";
import type { EvidenceAnswer } from "@/server/evidence/repository";
import { buildReportCsv } from "@/server/exports/csv";
import {
  campaignReportData,
  evidenceReportData,
} from "@/server/exports/data";
import { buildReportWorkbook } from "@/server/exports/workbook";

const ExportQuerySchema = z
  .object({
    revision: z.coerce.number().int().positive(),
    format: z.enum(["xlsx", "csv"]),
  })
  .strict();

type ArtifactSnapshot = {
  id: string;
  revision: number;
  saveState: "draft" | "saved";
  payload: ArtifactPayload;
};

type Dependencies = {
  requireUser(): Promise<CurrentUser>;
  getArtifact(artifactId: string, ownerId: string): Promise<ArtifactSnapshot>;
  getEvidence(factIds: readonly string[]): Promise<EvidenceAnswer[]>;
};

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function headers(filename: string, format: "xlsx" | "csv") {
  return {
    "Content-Type":
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}.${format}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export function createArtifactExportHandler(dependencies: Dependencies) {
  return async function artifactExportHandler(
    request: Request,
    artifactId: string,
  ) {
    try {
      const user = await dependencies.requireUser();
      const id = z.string().uuid().parse(artifactId);
      const url = new URL(request.url);
      const query = ExportQuerySchema.parse({
        revision: url.searchParams.get("revision"),
        format: url.searchParams.get("format"),
      });
      const artifact = await dependencies.getArtifact(id, user.id);
      const download = await prepareArtifactExport(
        { artifactId: id, expectedRevision: query.revision },
        {
          ownerId: user.id,
          getArtifact: async () => artifact,
        },
      );
      const report = artifact.payload.type === "plan"
        ? campaignReportData({ ...artifact, payload: artifact.payload })
        : artifact.payload.type === "evidence"
          ? evidenceReportData(
              { ...artifact, payload: artifact.payload },
              await dependencies.getEvidence(artifact.payload.factIds),
            )
          : null;
      if (!report) throw new Error("UNSUPPORTED_EXPORT_ARTIFACT");
      const responseHeaders = headers(download.filename, query.format);
      if (query.format === "csv") {
        return new Response(`\uFEFF${buildReportCsv(report)}`, {
          status: 200,
          headers: responseHeaders,
        });
      }
      const bytes = await buildReportWorkbook(report);
      return new Response(bytes, { status: 200, headers: responseHeaders });
    } catch (error) {
      const code = error instanceof Error ? error.message : "EXPORT_GENERATION_FAILED";
      if (code === "UNAUTHENTICATED" || error?.constructor?.name === "UnauthenticatedError") {
        return errorResponse("UNAUTHENTICATED", 401);
      }
      if (
        error instanceof z.ZodError ||
        code === "ARTIFACT_NOT_FOUND" ||
        code === "UNSUPPORTED_EXPORT_ARTIFACT" ||
        code.startsWith("STALE_ARTIFACT_REVISION:")
      ) {
        return errorResponse("ARTIFACT_NOT_FOUND", 404);
      }
      if (code.startsWith("EVIDENCE_EXPORT_INCOMPLETE:")) {
        return errorResponse("REPORT_DATA_INCOMPLETE", 409);
      }
      return errorResponse("EXPORT_GENERATION_FAILED", 500);
    }
  };
}
