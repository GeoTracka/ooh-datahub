import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "@/shared/canonicalJson";
import type {
  SurveyAggregateSnapshot,
  SurveyAggregateSnapshotContent,
} from "@/survey/contracts";
import { buildSurveyPlanningContextArtifactContent } from "@/survey/publishedContext";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

async function main(): Promise<void> {
  const snapshotPath = path.resolve(argValue("snapshot"));
  const outputPath = path.resolve(argValue("out"));
  const city = argValue("city");
  const snapshot = JSON.parse(
    await readFile(snapshotPath, "utf8"),
  ) as SurveyAggregateSnapshot;
  const { snapshotDigest, ...snapshotContent } = snapshot;
  const expectedSnapshotDigest = digest(
    snapshotContent satisfies SurveyAggregateSnapshotContent,
  );
  if (snapshotDigest !== expectedSnapshotDigest) {
    throw new Error("SURVEY_SNAPSHOT_DIGEST_MISMATCH");
  }
  const content = buildSurveyPlanningContextArtifactContent({
    snapshot,
    query: { city },
    maximumSignals: 3,
  });
  const artifact = { ...content, artifactDigest: digest(content) };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${canonicalJson(artifact)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        outputPath,
        artifactDigest: artifact.artifactDigest,
        sourceSnapshotDigest: artifact.sourceSnapshotDigest,
        scope: artifact.scope,
        sampleSize: artifact.sampleSize,
        profileCount: Object.keys(artifact.profiles).length,
        signalCounts: Object.fromEntries(
          Object.entries(artifact.profiles).map(([objective, profile]) => [
            objective,
            profile.signals.length,
          ]),
        ),
        decisionUse: artifact.decisionUse,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `consumer survey context publication failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
