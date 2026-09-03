import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "@/shared/canonicalJson";
import {
  RBL_LOMA_2026_SOURCE,
  parseRblLoma2026Rows,
  verifyRblLoma2026Structure,
} from "@/server/survey/rblLoma2026";
import { bindSurveyAggregateSnapshotDigest } from "@/server/survey/digest";
import { buildSurveyAggregateSnapshotContent } from "@/survey/aggregate";
import { loadConsumerSurveyWorkbook } from "./consumer-survey/workbook";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

function optionalIntegerArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`ARGUMENT_INVALID:${name}`);
  return value;
}

async function main(): Promise<void> {
  const outputPath = path.resolve(argValue("out"));
  const loaded = await loadConsumerSurveyWorkbook({
    sourcePath: argValue("source"),
    sheetName: RBL_LOMA_2026_SOURCE.sheetName,
  });
  const structure = verifyRblLoma2026Structure({
    sourceSha256: loaded.sourceSha256,
    sheetName: loaded.sheetName,
    headers: loaded.headers,
    dataRowCount: loaded.rows.length,
  });
  if (!structure.valid) {
    throw new Error(`SURVEY_STRUCTURE_INVALID:${structure.failures.join(",")}`);
  }
  const responses = parseRblLoma2026Rows(loaded.headers, loaded.rows);
  const content = buildSurveyAggregateSnapshotContent({
    source: RBL_LOMA_2026_SOURCE,
    responses,
    minimumSampleSize: optionalIntegerArg("minimum-sample-size", 30),
  });
  const snapshot = bindSurveyAggregateSnapshotDigest(content);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${canonicalJson(snapshot)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath,
    snapshotDigest: snapshot.snapshotDigest,
    responseCount: snapshot.responseCount,
    includedResponseCount: snapshot.includedResponseCount,
    facetCount: snapshot.facets.length,
    minimumSampleSize: snapshot.minimumSampleSize,
    decisionUse: snapshot.decisionUse,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`consumer survey derivation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
