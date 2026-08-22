import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSurveySegmentCatalogueContent } from "@/server/survey/buildSegmentCatalogue";
import { surveyAggregateSnapshotDigest } from "@/server/survey/digest";
import { bindSurveySegmentCatalogueDigest } from "@/server/survey/segmentCatalogueDigest";
import { canonicalJson } from "@/shared/canonicalJson";
import type {
  SurveyAggregateSnapshot,
  SurveyAggregateSnapshotContent,
} from "@/survey/contracts";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

async function main(): Promise<void> {
  const snapshotPath = path.resolve(argValue("snapshot"));
  const outputPath = path.resolve(argValue("out"));
  const city = argValue("city");
  const snapshot = JSON.parse(
    await readFile(snapshotPath, "utf8"),
  ) as SurveyAggregateSnapshot;
  const { snapshotDigest, ...snapshotContent } = snapshot;
  const expectedDigest = surveyAggregateSnapshotDigest(
    snapshotContent satisfies SurveyAggregateSnapshotContent,
  );
  if (snapshotDigest !== expectedDigest) {
    throw new Error("SURVEY_SNAPSHOT_DIGEST_MISMATCH");
  }
  const content = buildSurveySegmentCatalogueContent({ snapshot, city });
  const catalogue = bindSurveySegmentCatalogueDigest(content);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${canonicalJson(catalogue)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        outputPath,
        catalogueDigest: catalogue.catalogueDigest,
        sourceSnapshotDigest: catalogue.sourceSnapshotDigest,
        city: catalogue.city,
        minimumSampleSize: catalogue.minimumSampleSize,
        profileCount: catalogue.profiles.length,
        profiles: catalogue.profiles.map(({ id, sampleSize }) => ({
          id,
          sampleSize,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `consumer survey segment publication failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
