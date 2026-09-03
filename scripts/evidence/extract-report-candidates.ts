import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { requiredEnvironmentPath, writeJsonAtomic } from "./io";

export async function extractReportCandidates(reportPath: string) {
  const bytes = new Uint8Array(await readFile(reportPath));
  const pdf = await getDocument({ data: bytes }).promise;
  const candidates: Array<{ page: number; text: string }> = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    if (
      /method|sample|creative|format|mobility|traffic|supply|spend|forecast|limitation/i.test(
        text,
      )
    ) {
      candidates.push({ page: pageNumber, text: text.slice(0, 4_000) });
    }
  }
  return candidates;
}

async function main(): Promise<void> {
  const reportPath = requiredEnvironmentPath("RBL_LOMA_REPORT_PATH");
  const stagingDirectory = path.resolve(
    process.env.RBL_LOMA_EVIDENCE_STAGING_DIR?.trim() ||
      ".local/evidence/rbl-loma-2026",
  );
  const candidates = await extractReportCandidates(reportPath);
  await writeJsonAtomic(
    path.join(stagingDirectory, "restricted-report-candidates.json"),
    {
      accessClass: "restricted_review_material",
      pages: candidates,
    },
  );
  process.stdout.write(`Extracted ${candidates.length} report pages for review.\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
