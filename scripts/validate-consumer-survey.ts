import {
  RBL_LOMA_2026_SOURCE,
  parseRblLoma2026Rows,
  verifyRblLoma2026Structure,
} from "@/server/survey/rblLoma2026";
import { loadConsumerSurveyWorkbook } from "./consumer-survey/workbook";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

async function main(): Promise<void> {
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
    process.stdout.write(`${JSON.stringify({
      sourceId: RBL_LOMA_2026_SOURCE.id,
      structureValid: false,
      failures: structure.failures,
      sourceSha256: loaded.sourceSha256,
      headerSha256: structure.headerSha256,
      dataRows: loaded.rows.length,
      columns: loaded.headers.length,
    }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const responses = parseRblLoma2026Rows(loaded.headers, loaded.rows);
  const diagnosticCounts = new Map<string, number>();
  for (const response of responses) {
    for (const diagnostic of response.diagnostics) {
      diagnosticCounts.set(diagnostic.code, (diagnosticCounts.get(diagnostic.code) ?? 0) + 1);
    }
  }
  const cities = [...new Set(responses.flatMap((response) => response.city ? [response.city] : []))]
    .sort((left, right) => left.localeCompare(right));
  const formVersions = [...new Set(responses.flatMap((response) =>
    response.formVersion ? [response.formVersion] : [],
  ))].sort((left, right) => left.localeCompare(right));

  process.stdout.write(`${JSON.stringify({
    sourceId: RBL_LOMA_2026_SOURCE.id,
    structureValid: true,
    authoritative: true,
    commercialUse: RBL_LOMA_2026_SOURCE.commercialUse,
    decisionUse: RBL_LOMA_2026_SOURCE.decisionUse,
    sourceSha256: loaded.sourceSha256,
    headerSha256: structure.headerSha256,
    dataRows: responses.length,
    contextEligibleRows: responses.filter((response) => response.contextEligible).length,
    cities,
    formVersions,
    advisoryDiagnostics: Object.fromEntries(
      [...diagnosticCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`consumer survey validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
