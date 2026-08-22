import { describe, expect, it } from "vitest";
import {
  RBL_LOMA_2026_HEADERS,
  RBL_LOMA_2026_SOURCE,
  buildRblLoma2026HeaderIndex,
  parseRblLoma2026Response,
  verifyRblLoma2026Structure,
  type RblLoma2026HeaderKey,
  type SurveySpreadsheetCell,
} from "@/server/survey/rblLoma2026";

function fixture() {
  const headers = Object.values(RBL_LOMA_2026_HEADERS);
  const index = buildRblLoma2026HeaderIndex(headers);
  const row: SurveySpreadsheetCell[] = Array.from({ length: headers.length }, () => null);
  const set = (key: RblLoma2026HeaderKey, value: SurveySpreadsheetCell) => {
    row[index[key]] = value;
  };
  set("start", new Date("2026-05-20T09:00:00.000Z"));
  set("end", new Date("2026-05-20T09:15:00.000Z"));
  set("consent", "Yes");
  set("residenceEligible", "Yes");
  set("city", "Lagos");
  set("ageBand", "26-35");
  set("gender", "Female");
  set("occupation", "Professional");
  set("incomeBand", "N500,000+");
  set("transportMode", "Private car");
  set("oohAttention", "High");
  set("weeklyNoticeFrequency", "8-14");
  set("recallLastFourWeeks", "Yes");
  set("recallAbout", "FMCG launch");
  set("recallBrand", "Demo brand");
  set("recallWhere", "Major road");
  set("primaryEnvironment", "Major roads or highways");
  set("hardestToIgnoreFormat", "Large static billboard");
  set("memorabilityDriver", "Size/visibility");
  set("commuteMood", "Calm");
  set("trafficAttention", "5 Very attentive");
  set("bestRoad", "Ikorodu Road");
  set("bestArea", "Ikeja");
  set("latitude", 6.5244);
  set("longitude", 3.3792);
  set("gpsPrecision", 10);
  set("formVersion", "v3");

  for (const key of ["topFormatLargeBillboard", "topFormatDigitalLed", "topFormatTransit"] as const) {
    set(key, 1);
  }
  for (const key of ["commuteAttentionBillboards", "commuteAttentionTraffic"] as const) {
    set(key, 1);
  }
  for (const key of ["attentionDriverBright", "attentionDriverRelevant"] as const) {
    set(key, 1);
  }
  set("actionSearch", 1);
  set("actionPurchase", 1);
  set("categoryFmcg", 1);

  const ratingKeys = (Object.keys(RBL_LOMA_2026_HEADERS) as RblLoma2026HeaderKey[])
    .filter((key) => key.startsWith("rating"));
  ratingKeys.forEach((key, offset) => set(key, offset === 0 ? 5 : 4));
  return { headers, index, row, set };
}

describe("RBL–LOMA 2026 survey adapter", () => {
  it("binds the authoritative owner-supplied source contract", () => {
    expect(RBL_LOMA_2026_SOURCE).toMatchObject({
      expectedDataRows: 1844,
      expectedColumns: 302,
      authority: "solution_owner_authoritative",
      cleaningStatus: "authoritative_cleaned_final",
      commercialUse: "owner_authorized_unrestricted",
      decisionUse: "context_only",
    });
    expect(RBL_LOMA_2026_SOURCE.sha256).toHaveLength(64);
    expect(RBL_LOMA_2026_SOURCE.headerSha256).toHaveLength(64);
  });

  it("parses de-identified consumer context without retaining GPS or collector identity", () => {
    const { row, index } = fixture();
    const response = parseRblLoma2026Response(row, index, 2);
    expect(response).toMatchObject({
      sourceRowNumber: 2,
      contextEligible: true,
      city: "Lagos",
      ageBand: "26-35",
      transportMode: "Private car",
      recalledOohLastFourWeeks: true,
      recallDetailComplete: true,
      topFormats: ["Large billboard", "Digital screen or LED", "Bus or vehicle wrap"],
      actions: ["Searched online", "Purchased product or service"],
      responsiveCategories: ["FMCG"],
      diagnostics: [],
    });
    expect(response.formatRatings.large_billboard?.attention).toBe(5);
    expect(response).not.toHaveProperty("latitude");
    expect(response).not.toHaveProperty("longitude");
    expect(response).not.toHaveProperty("deviceId");
    expect(response).not.toHaveProperty("interviewer");
  });

  it("keeps owner-approved rows but records question-level diagnostics", () => {
    const { row, index, set } = fixture();
    set("consent", "No");
    set("topFormatDigitalLed", null);
    set("commuteAttentionTraffic", null);
    set("attentionDriverRelevant", null);
    set("recallLastFourWeeks", "No");
    set("recallBrand", "Demo brand");
    const ratingKeys = (Object.keys(RBL_LOMA_2026_HEADERS) as RblLoma2026HeaderKey[])
      .filter((key) => key.startsWith("rating"));
    ratingKeys.forEach((key) => set(key, 3));

    const response = parseRblLoma2026Response(row, index, 7);
    expect(response.contextEligible).toBe(false);
    expect(response.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "CONTEXT_SCREEN_NOT_ELIGIBLE",
      "TOP3_FORMAT_COUNT_DIAGNOSTIC",
      "TOP2_COMMUTE_COUNT_DIAGNOSTIC",
      "TOP2_DRIVER_COUNT_DIAGNOSTIC",
      "RECALL_NO_WITH_FOLLOWUP",
      "FORMAT_MATRIX_STRAIGHTLINE",
    ]));
  });

  it("fails closed when the immutable workbook structure drifts", () => {
    const result = verifyRblLoma2026Structure({
      sourceSha256: "0".repeat(64),
      sheetName: "Wrong sheet",
      headers: ["start"],
      dataRowCount: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.failures).toEqual([
      "SOURCE_SHA256_MISMATCH",
      "SHEET_NAME_MISMATCH",
      "COLUMN_COUNT_MISMATCH",
      "HEADER_SHA256_MISMATCH",
      "DATA_ROW_COUNT_MISMATCH",
    ]);
  });
});
