import { z } from "zod";

import type { ArtifactPayload } from "@/server/artifacts/contracts";
import {
  DownloadDescriptorSchema,
  type DownloadDescriptor,
} from "@/server/chat/contracts";

export const PrepareArtifactExportArgsSchema = z
  .object({
    artifactId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export type PrepareArtifactExportArgs = z.infer<
  typeof PrepareArtifactExportArgsSchema
>;

type CurrentArtifact = {
  id: string;
  revision: number;
  payload: ArtifactPayload;
};

type ArtifactReader = (
  artifactId: string,
  ownerId: string,
) => Promise<CurrentArtifact>;

function filenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-NG")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function descriptorForArtifact(
  artifact: CurrentArtifact,
): DownloadDescriptor {
  if (artifact.payload.type === "plan") {
    const title = `${artifact.payload.brief.productName} campaign plan`;
    return DownloadDescriptorSchema.parse({
      artifactId: artifact.id,
      revision: artifact.revision,
      reportKind: "campaign_plan",
      title,
      filename: `${filenamePart(title) || "campaign-plan"}-r${artifact.revision}`,
      formats: ["xlsx", "csv"],
    });
  }
  if (artifact.payload.type === "evidence") {
    const title = "Outdoor audience evidence report";
    return DownloadDescriptorSchema.parse({
      artifactId: artifact.id,
      revision: artifact.revision,
      reportKind: "evidence_report",
      title,
      filename: `${filenamePart(title)}-r${artifact.revision}`,
      formats: ["xlsx", "csv"],
    });
  }
  throw new Error("UNSUPPORTED_EXPORT_ARTIFACT");
}

export async function prepareArtifactExport(
  input: PrepareArtifactExportArgs,
  context: { ownerId: string; getArtifact: ArtifactReader },
) {
  const args = PrepareArtifactExportArgsSchema.parse(input);
  const artifact = await context.getArtifact(args.artifactId, context.ownerId);
  if (artifact.revision !== args.expectedRevision) {
    throw new Error(
      `STALE_ARTIFACT_REVISION:${artifact.revision}:${args.expectedRevision}`,
    );
  }
  return descriptorForArtifact(artifact);
}
