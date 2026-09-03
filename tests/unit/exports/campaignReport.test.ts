import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";

import type { PlanArtifactPayload } from "@/server/artifacts/contracts";
import { buildCampaignPlan } from "@/server/ai/tools/plannerTools";
import { campaignReportData } from "@/server/exports/data";
import { buildReportCsv } from "@/server/exports/csv";
import { buildReportWorkbook } from "@/server/exports/workbook";
import { validBrief } from "../../fixtures/aiRuntime";

let plan: PlanArtifactPayload;

beforeAll(async () => {
  plan = await buildCampaignPlan(validBrief);
});

describe("campaign plan reports", () => {
  it("creates a polished workbook with all three approaches and limits", async () => {
    const data = campaignReportData({
      id: "11111111-1111-4111-8111-111111111111",
      revision: 2,
      saveState: "draft",
      payload: plan,
    });
    const bytes = await buildReportWorkbook(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Plan options",
      "Sources & limits",
    ]);
    expect(workbook.getWorksheet("Summary")?.getCell("B4").value).toBe(
      "Everyday essentials",
    );
    expect(
      workbook
        .getWorksheet("Plan options")
        ?.getColumn(1)
        .values.slice(2, 5),
    ).toEqual(["Balanced plan", "Highest delivery", "Budget-smart plan"]);
    expect(workbook.getWorksheet("Plan options")?.views[0]).toMatchObject({
      state: "frozen",
      ySplit: 1,
    });
    expect(
      workbook.getWorksheet("Sources & limits")?.getCell("A4").value,
    ).toBe("Draft, not booked");
  });

  it("creates a flat CSV and escapes spreadsheet formulas", () => {
    const unsafe: PlanArtifactPayload = {
      ...plan,
      options: plan.options.map((option, index) =>
        index === 0 ? { ...option, tradeoffs: ["=HYPERLINK(\"bad\")"] } : option,
      ) as PlanArtifactPayload["options"],
    };
    const csv = buildReportCsv(
      campaignReportData({
        id: "11111111-1111-4111-8111-111111111111",
        revision: 1,
        saveState: "draft",
        payload: unsafe,
      }),
    );

    expect(csv).toContain("Approach,Style,Cost NGN");
    expect(csv).toContain("Balanced plan");
    expect(csv).toContain("'=HYPERLINK");
  });
});
