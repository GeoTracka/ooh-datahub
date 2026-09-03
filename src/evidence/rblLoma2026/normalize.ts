import type {
  NormalizeResult,
  NormalizedRatings,
  NormalizedSelections,
  RblLomaCityId,
} from "@/evidence/contracts";
import {
  RBL_COLUMNS,
  RBL_MULTI_COLUMN_RANGES,
  valueAtOneBasedColumn,
} from "@/evidence/rblLoma2026/columns";

const CITY_ALIASES: Readonly<Record<string, RblLomaCityId>> = {
  aba: "aba",
  abuja: "abuja",
  asaba: "asaba",
  benin: "benin_city",
  "benin city": "benin_city",
  enugu: "enugu",
  ibadan: "ibadan",
  kaduna: "kaduna",
  kano: "kano",
  lagos: "lagos",
  onitsha: "onitsha",
  ph: "port_harcourt",
  "port harcourt": "port_harcourt",
  portharcourt: "port_harcourt",
  sokoto: "sokoto",
};

function normalizedText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function lookupToken(value: unknown): string | null {
  const text = normalizedText(value);
  if (!text) return null;
  return text
    .toLocaleLowerCase("en-NG")
    .replace(/[\-_]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function selectionsFromRange(
  cells: readonly unknown[],
  [start, end]: readonly [number, number],
): NormalizedSelections {
  const selections: Record<string, string> = {};
  for (let column = start; column <= end; column += 1) {
    const value = normalizedText(valueAtOneBasedColumn(cells, column));
    if (value) selections[`c${column}`] = value;
  }
  return selections;
}

function ratingsFromRange(
  cells: readonly unknown[],
  [start, end]: readonly [number, number],
): NormalizedRatings {
  const ratings: Record<string, number> = {};
  for (let column = start; column <= end; column += 1) {
    const value = normalizedText(valueAtOneBasedColumn(cells, column));
    if (!value) continue;
    const rating = Number(value);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      ratings[`c${column}`] = rating;
    }
  }
  return ratings;
}

export function normalizeSurveyRow(
  cells: readonly unknown[],
  rowNumber: number,
): NormalizeResult {
  const cityToken = lookupToken(valueAtOneBasedColumn(cells, RBL_COLUMNS.city));
  if (!cityToken) {
    return { kind: "quarantined", rowNumber, reason: "missing_city" };
  }

  const city = CITY_ALIASES[cityToken];
  if (!city) {
    return { kind: "quarantined", rowNumber, reason: "unknown_city" };
  }

  const eligible = lookupToken(
    valueAtOneBasedColumn(cells, RBL_COLUMNS.commuteEligibility),
  );
  if (eligible !== "yes") {
    return {
      kind: "quarantined",
      rowNumber,
      reason: "not_resident_or_regular_commuter",
    };
  }

  const field = (column: number) =>
    normalizedText(valueAtOneBasedColumn(cells, column));

  return {
    kind: "accepted",
    row: {
      rowNumber,
      city,
      ageBand: field(RBL_COLUMNS.ageBand),
      gender: field(RBL_COLUMNS.gender),
      occupation: field(RBL_COLUMNS.occupation),
      incomeBand: field(RBL_COLUMNS.incomeBand),
      mobility: {
        travelFrequency: field(RBL_COLUMNS.travelFrequency),
        weekdayTime: field(RBL_COLUMNS.weekdayTime),
        weekdayTimes: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.weekdayTimes,
        ),
        primaryTransport: field(RBL_COLUMNS.primaryTransport),
        journeyAttention: field(RBL_COLUMNS.journeyAttention),
        weeklyEnvironments: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.weeklyEnvironments,
        ),
      },
      formats: {
        categoryRecall: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.categoryRecall,
        ),
        noticedFrequency: field(RBL_COLUMNS.noticedFrequency),
        topFormats: selectionsFromRange(cells, RBL_MULTI_COLUMN_RANGES.topFormats),
        exposureEnvironment: field(RBL_COLUMNS.exposureEnvironment),
        fourWeekRecall: field(RBL_COLUMNS.fourWeekRecall),
        hardestToIgnore: field(RBL_COLUMNS.hardestToIgnore),
        commuteMood: field(RBL_COLUMNS.commuteMood),
        commuteAttention: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.commuteAttention,
        ),
        ratings: ratingsFromRange(cells, RBL_MULTI_COLUMN_RANGES.formatRatings),
      },
      creative: {
        triggers: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.creativeTriggers,
        ),
      },
      actions: {
        reported: selectionsFromRange(
          cells,
          RBL_MULTI_COLUMN_RANGES.reportedActions,
        ),
      },
      restrictedOpenText: {
        route: field(RBL_COLUMNS.routeOpenText),
        area: field(RBL_COLUMNS.areaOpenText),
      },
    },
  };
}
