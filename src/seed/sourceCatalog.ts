export type OohPlacementLayout = "year-quarter-month" | "quarter-month-year";

export type OohPlacementSheetSpec = {
  sheet: string;
  layout: OohPlacementLayout;
  expectedDataRows: number;
  supersedeYears?: number[];
};

export type OohBoardQualitySheetSpec = {
  sheet: string;
  expectedDataRows: number;
  contextYear: number;
};

export type FaanFlowMetric = "passenger" | "aircraft";
export type FaanFlowScope = "domestic" | "international" | "hajj";

export type FaanFlowSectionSpec = {
  sheet: string;
  metric: FaanFlowMetric;
  scope: FaanFlowScope;
  rowStart: number;
  rowEnd: number;
  airportStateColumn: number;
  airportNameColumn: number | null;
  monthStartColumn: number;
};

export type FaanWeightMetric = "cargo" | "mail";

export type FaanWeightSectionSpec = {
  sheet: string;
  metric: FaanWeightMetric;
  rowStart: number;
  rowEnd: number;
  airportColumn: number;
  monthStartColumns: number[];
  annualStartColumn: number;
};

export type OohSourceSpec = {
  kind: "ooh";
  id: string;
  fileName: string;
  driveFileId: string;
  sha256: string;
  placementSheets: OohPlacementSheetSpec[];
  boardQualitySheets?: OohBoardQualitySheetSpec[];
};

export type FaanSourceSpec = {
  kind: "faan";
  id: string;
  fileName: string;
  driveFileId: string;
  sha256: string;
  year: number;
  flowSections: FaanFlowSectionSpec[];
  weightSections: FaanWeightSectionSpec[];
};

export type SeedSourceSpec = OohSourceSpec | FaanSourceSpec;

const weight2023Months = [1, 3, 5, 7, 9, 11, 13, 16, 19, 22, 25, 28];
const weight2024Months = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

export const SEED_SOURCE_CATALOG_VERSION = "drive-ooh-faan-v1";

export const seedSourceCatalog: SeedSourceSpec[] = [
  {
    kind: "ooh",
    id: "ooh-historical-2018-2023-ytd-r1",
    fileName: "OOH HISTORICAL DATA YTD (2018-2023) - Last Updated in October'23 (2).xlsx",
    driveFileId: "1zTMMrbfM7LeYIlPs1tqENk9XmOeFUYda",
    sha256: "a4d252d60f4f1e31d150c84e1b216fb45c0ce23decdcf4c39478e0a4c4cf9c9a",
    placementSheets: [
      {
        sheet: "Sheet1",
        layout: "year-quarter-month",
        expectedDataRows: 119_524,
        // The artifact itself is YTD through October 2023. The final FY2023
        // workbook is the authoritative 2023 revision, so these rows remain
        // auditable but must not be counted as active canonical observations.
        supersedeYears: [2023],
      },
    ],
  },
  {
    kind: "ooh",
    id: "ooh-full-year-2023-r1",
    fileName: "OOH INDUSTRY DATA, FULL YEAR 2023 (1).xlsx",
    driveFileId: "1Ox30GAOxvGMzZqMLAc15bRfhnRL8Bs0T",
    sha256: "a34b37ee3862d4bc0305729fa1776ef180805fcc37bd250c486d8044b9412b74",
    placementSheets: [
      {
        sheet: "DATA",
        layout: "year-quarter-month",
        expectedDataRows: 40_096,
      },
    ],
    boardQualitySheets: [
      {
        sheet: "NB SOV",
        expectedDataRows: 6_102,
        contextYear: 2023,
      },
    ],
  },
  {
    kind: "ooh",
    id: "ooh-fy2024-q1-2025-r1",
    fileName: "OOH Industry Data (FY 2024 - Q1 2025).xlsx",
    driveFileId: "17S9-K74evgXkEDd8meOgiFjU98T9rSUE",
    sha256: "4989755c6465ce1512ce6df04e12f67ee814eb844b72580405e15cc86bceb21e",
    placementSheets: [
      {
        sheet: "FY 24 - Q1 25",
        layout: "quarter-month-year",
        expectedDataRows: 42_932,
      },
    ],
  },
  {
    kind: "faan",
    id: "faan-traffic-2023-r1",
    fileName: "FAAN ANNUAL HARMONIZED FIGURE JAN- DEC 2023 (1).xlsx",
    driveFileId: "107IlFOVUIMPSpy7rxxz5TfJk1_Dnp05S",
    sha256: "6f9a745de078684fbcdb6115f36df5d45581b53dafdb9441ae8b0c9428cddbbc",
    year: 2023,
    flowSections: [
      { sheet: "Sheet1", metric: "passenger", scope: "domestic", rowStart: 10, rowEnd: 30, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
      { sheet: "Sheet1", metric: "passenger", scope: "international", rowStart: 37, rowEnd: 41, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
      { sheet: "Sheet1", metric: "passenger", scope: "hajj", rowStart: 48, rowEnd: 55, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
      { sheet: "Sheet2", metric: "aircraft", scope: "domestic", rowStart: 8, rowEnd: 28, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
      { sheet: "Sheet2", metric: "aircraft", scope: "international", rowStart: 36, rowEnd: 40, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
      { sheet: "Sheet2", metric: "aircraft", scope: "hajj", rowStart: 47, rowEnd: 54, airportStateColumn: 0, airportNameColumn: null, monthStartColumn: 1 },
    ],
    weightSections: [
      { sheet: "Sheet3", metric: "cargo", rowStart: 9, rowEnd: 13, airportColumn: 0, monthStartColumns: weight2023Months, annualStartColumn: 31 },
      { sheet: "Sheet3", metric: "mail", rowStart: 20, rowEnd: 24, airportColumn: 0, monthStartColumns: weight2023Months, annualStartColumn: 31 },
    ],
  },
  {
    kind: "faan",
    id: "faan-traffic-2024-r1",
    fileName: "FAAN HARMONIZED JANUARY - DECEMBER 2024  DATA (1).xlsx",
    driveFileId: "14LgQ6DiPOQYhBOJbGesnNAK57K7KEJ9K",
    sha256: "6999c1d1865db0f47230750ce07dbaf462abc5e284567c49ee33dbcf7beabe03",
    year: 2024,
    flowSections: [
      { sheet: "Sheet1", metric: "passenger", scope: "domestic", rowStart: 9, rowEnd: 30, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
      { sheet: "Sheet1", metric: "passenger", scope: "international", rowStart: 38, rowEnd: 42, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
      { sheet: "Sheet1", metric: "passenger", scope: "hajj", rowStart: 49, rowEnd: 57, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
      { sheet: "Sheet2", metric: "aircraft", scope: "domestic", rowStart: 9, rowEnd: 30, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
      { sheet: "Sheet2", metric: "aircraft", scope: "international", rowStart: 38, rowEnd: 42, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
      { sheet: "Sheet2", metric: "aircraft", scope: "hajj", rowStart: 49, rowEnd: 57, airportStateColumn: 0, airportNameColumn: 1, monthStartColumn: 2 },
    ],
    weightSections: [
      { sheet: "Sheet3", metric: "cargo", rowStart: 9, rowEnd: 13, airportColumn: 0, monthStartColumns: weight2024Months, annualStartColumn: 25 },
      { sheet: "Sheet3", metric: "mail", rowStart: 20, rowEnd: 24, airportColumn: 0, monthStartColumns: weight2024Months, annualStartColumn: 25 },
    ],
  },
  {
    kind: "faan",
    id: "faan-traffic-2025-r1",
    fileName: "FAAN TRAFFIC REPORT JAN - DEC 2025 PERCENTAGE.xlsx",
    driveFileId: "1tp1ddNK0wvm1bYzr46FS2gkfbhpnEBjh",
    sha256: "8014c603bca7b32003bea735b1434dcddfced8e21a782a422da49a08b7f4470b",
    year: 2025,
    flowSections: [
      { sheet: "Sheet1", metric: "passenger", scope: "domestic", rowStart: 10, rowEnd: 31, airportStateColumn: 2, airportNameColumn: 3, monthStartColumn: 6 },
      { sheet: "Sheet1", metric: "passenger", scope: "international", rowStart: 38, rowEnd: 42, airportStateColumn: 2, airportNameColumn: 3, monthStartColumn: 6 },
      { sheet: "Sheet1", metric: "passenger", scope: "hajj", rowStart: 49, rowEnd: 58, airportStateColumn: 2, airportNameColumn: 3, monthStartColumn: 6 },
    ],
    // The supplied 2025 workbook does not contain aircraft, cargo or mail
    // sections. Absence is recorded in the seed report rather than imputed.
    weightSections: [],
  },
];

export function findSeedSource(id: string): SeedSourceSpec {
  const source = seedSourceCatalog.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`UNKNOWN_SEED_SOURCE:${id}`);
  return source;
}
