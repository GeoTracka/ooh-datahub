import { describe, expect, it } from "vitest";

import { normalizeSurveyRow } from "@/evidence/rblLoma2026/normalize";

describe("normalizeSurveyRow", () => {
  it("keeps permitted fields and drops identities and GPS", () => {
    const cells: unknown[] = [];
    cells[6] = "Interviewer name";
    cells[7] = "6.5 3.3";
    cells[13] = "  Lagos  ";
    cells[114] = "Yes";
    cells[117] = "25-34";
    cells[119] = "Female";
    cells[155] = "A lot of attention";

    const result = normalizeSurveyRow(cells, 2);

    expect(result).toMatchObject({
      kind: "accepted",
      row: {
        rowNumber: 2,
        city: "lagos",
        ageBand: "25-34",
        gender: "Female",
        mobility: { journeyAttention: "A lot of attention" },
      },
    });
    expect(JSON.stringify(result)).not.toContain("Interviewer name");
    expect(JSON.stringify(result)).not.toContain("6.5 3.3");
  });

  it("quarantines screening-close records", () => {
    const cells: unknown[] = [];
    cells[13] = "Lagos";
    cells[114] = "No";

    expect(normalizeSurveyRow(cells, 9)).toMatchObject({
      kind: "quarantined",
      rowNumber: 9,
      reason: "not_resident_or_regular_commuter",
    });
  });

  it.each([
    ["Benin", "benin_city"],
    ["PH", "port_harcourt"],
    ["Port-Harcourt", "port_harcourt"],
    ["ABUJA", "abuja"],
  ])("maps %s to the stable city id %s", (sourceCity, city) => {
    const cells: unknown[] = [];
    cells[13] = sourceCity;
    cells[114] = "Yes";

    expect(normalizeSurveyRow(cells, 3)).toMatchObject({
      kind: "accepted",
      row: { city },
    });
  });

  it("quarantines missing and unknown cities", () => {
    const missing: unknown[] = [];
    missing[114] = "Yes";
    expect(normalizeSurveyRow(missing, 4)).toMatchObject({
      kind: "quarantined",
      reason: "missing_city",
    });

    const unknown: unknown[] = [];
    unknown[13] = "Outside study coverage";
    unknown[114] = "Yes";
    expect(normalizeSurveyRow(unknown, 5)).toMatchObject({
      kind: "quarantined",
      reason: "unknown_city",
    });
  });

  it("accepts only valid 1-5 format ratings and keeps open text restricted", () => {
    const cells: unknown[] = [];
    cells[13] = "Lagos";
    cells[114] = "Yes";
    cells[164] = "Third Mainland Bridge";
    cells[165] = "Ikeja";
    cells[225] = "5";
    cells[226] = 0;
    cells[227] = 6;
    cells[228] = "3";

    expect(normalizeSurveyRow(cells, 6)).toMatchObject({
      kind: "accepted",
      row: {
        restrictedOpenText: {
          route: "Third Mainland Bridge",
          area: "Ikeja",
        },
        formats: {
          ratings: {
            c226: 5,
            c229: 3,
          },
        },
      },
    });
  });
});
