import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import { auditSources } from "../../../scripts/evidence/audit-rbl-loma";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function fixtureDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "rbl-loma-audit-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

describe("auditSources", () => {
  it("rejects source checksum mismatches before parsing", async () => {
    const directory = await fixtureDirectory();
    const workbookPath = path.join(directory, "workbook.xlsx");
    const reportPath = path.join(directory, "report.pdf");
    await writeFile(workbookPath, "not the reviewed workbook");
    await writeFile(reportPath, "not the reviewed report");

    await expect(
      auditSources({ workbookPath, reportPath }),
    ).rejects.toThrow("SOURCE_CHECKSUM_MISMATCH");
  });

  it("rejects a workbook that does not match the reviewed schema", async () => {
    const directory = await fixtureDirectory();
    const workbookPath = path.join(directory, "workbook.xlsx");
    const reportPath = path.join(directory, "report.pdf");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Wrong sheet");
    worksheet.addRow(["city"]);
    await workbook.xlsx.writeFile(workbookPath);
    await writeFile(reportPath, "%PDF-fixture");

    await expect(
      auditSources({
        workbookPath,
        reportPath,
        expectedWorkbookSha256: await sha256(workbookPath),
        expectedReportSha256: await sha256(reportPath),
      }),
    ).rejects.toThrow("WORKBOOK_SCHEMA_MISMATCH");
  });

  it("rejects restricted respondent fields in a publication payload", async () => {
    const directory = await fixtureDirectory();
    const workbookPath = path.join(directory, "workbook.xlsx");
    const reportPath = path.join(directory, "report.pdf");
    await writeFile(workbookPath, "fixture");
    await writeFile(reportPath, "fixture");

    await expect(
      auditSources({
        workbookPath,
        reportPath,
        expectedWorkbookSha256: await sha256(workbookPath),
        expectedReportSha256: await sha256(reportPath),
        publicationPayload: {
          facts: [],
          restrictedOpenText: { route: "Home to work" },
        },
      }),
    ).rejects.toThrow("PRIVACY_FIELD_IN_PUBLICATION");
  });
});
