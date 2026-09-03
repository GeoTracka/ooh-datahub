/**
 * Reviewed one-based columns from the pinned `Nigeria OOH 3` worksheet.
 * Identity, interviewer, device, GPS, submission, and raw metadata columns are
 * deliberately absent from this contract.
 */
export const RBL_COLUMNS = {
  city: 14,
  commuteEligibility: 115,
  ageBand: 118,
  gender: 120,
  occupation: 121,
  incomeBand: 125,
  travelFrequency: 140,
  weekdayTime: 143,
  primaryTransport: 154,
  journeyAttention: 156,
  routeOpenText: 165,
  areaOpenText: 166,
  noticedFrequency: 190,
  exposureEnvironment: 202,
  fourWeekRecall: 205,
  hardestToIgnore: 211,
  commuteMood: 214,
} as const;

export const RBL_MULTI_COLUMN_RANGES = {
  weekdayTimes: [143, 149],
  weeklyEnvironments: [158, 164],
  categoryRecall: [167, 189],
  topFormats: [192, 201],
  commuteAttention: [215, 222],
  formatRatings: [226, 258],
  creativeTriggers: [262, 268],
  reportedActions: [270, 276],
} as const satisfies Record<string, readonly [number, number]>;

export type RblColumnName = keyof typeof RBL_COLUMNS;
export type RblMultiColumnRangeName = keyof typeof RBL_MULTI_COLUMN_RANGES;

export function valueAtOneBasedColumn(
  row: readonly unknown[],
  column: number,
): unknown {
  if (!Number.isInteger(column) || column < 1) {
    throw new Error(`INVALID_ONE_BASED_COLUMN:${column}`);
  }
  return row[column - 1];
}

export function valuesInOneBasedRange(
  row: readonly unknown[],
  range: readonly [number, number],
): unknown[] {
  const [start, end] = range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new Error(`INVALID_ONE_BASED_RANGE:${start}:${end}`);
  }
  return row.slice(start - 1, end);
}
