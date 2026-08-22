import "server-only";

import type {
  CanonicalSurveyResponse,
  SurveyFormat,
  SurveyFormatAttribute,
  SurveyFormatRatings,
  SurveyRowDiagnostic,
} from "@/survey/contracts";
import {
  buildRblLoma2026HeaderIndex,
  type RblLoma2026HeaderIndex,
  type RblLoma2026HeaderKey,
} from "./rblLoma2026Headers";

export type SurveySpreadsheetCell = string | number | boolean | Date | null | undefined;

const formatRatingHeaderKeys: Record<
  SurveyFormat,
  Record<SurveyFormatAttribute, RblLoma2026HeaderKey>
> = {
  large_billboard: {
    attention: "ratingAttentionLargeBillboard",
    recall: "ratingRecallLargeBillboard",
    trust: "ratingTrustLargeBillboard",
    effect: "ratingEffectLargeBillboard",
    quality_feel: "ratingQualityLargeBillboard",
  },
  digital_led: {
    attention: "ratingAttentionDigitalLed",
    recall: "ratingRecallDigitalLed",
    trust: "ratingTrustDigitalLed",
    effect: "ratingEffectDigitalLed",
    quality_feel: "ratingQualityDigitalLed",
  },
  transit_vehicle: {
    attention: "ratingAttentionTransit",
    recall: "ratingRecallTransit",
    trust: "ratingTrustTransit",
    effect: "ratingEffectTransit",
    quality_feel: "ratingQualityTransit",
  },
  airport: {
    attention: "ratingAttentionAirport",
    recall: "ratingRecallAirport",
    trust: "ratingTrustAirport",
    effect: "ratingEffectAirport",
    quality_feel: "ratingQualityAirport",
  },
  street_furniture: {
    attention: "ratingAttentionStreetFurniture",
    recall: "ratingRecallStreetFurniture",
    trust: "ratingTrustStreetFurniture",
    effect: "ratingEffectStreetFurniture",
    quality_feel: "ratingQualityStreetFurniture",
  },
};

const topFormatHeaders: Array<[RblLoma2026HeaderKey, string]> = [
  ["topFormatLargeBillboard", "Large billboard"],
  ["topFormatDigitalLed", "Digital screen or LED"],
  ["topFormatTransit", "Bus or vehicle wrap"],
  ["topFormatMall", "Mall screen"],
  ["topFormatAirport", "Airport ad"],
  ["topFormatPoleBanner", "Street sign or pole banner"],
  ["topFormatBusShelter", "Bus shelter ad"],
  ["topFormatBuildingBranding", "Building branding or painting"],
  ["topFormatStreetFurniture", "Street furniture or roundabout"],
  ["topFormatThreeDimensional", "3D or life-size display"],
];

const commuteAttentionHeaders: Array<[RblLoma2026HeaderKey, string]> = [
  ["commuteAttentionBillboards", "Billboards or signs"],
  ["commuteAttentionPhone", "Phone"],
  ["commuteAttentionPassengers", "Other passengers"],
  ["commuteAttentionTraffic", "Traffic or road"],
  ["commuteAttentionRadio", "Music or radio"],
  ["commuteAttentionNothing", "Nothing in particular"],
];

const attentionDriverHeaders: Array<[RblLoma2026HeaderKey, string]> = [
  ["attentionDriverBright", "Bigger or brighter display"],
  ["attentionDriverFunny", "Funny or entertaining content"],
  ["attentionDriverRelevant", "Relevant to my life"],
  ["attentionDriverCelebrity", "Celebrity or influencer"],
  ["attentionDriverAnimated", "Moving or animated display"],
  ["attentionDriverLocalLanguage", "Local language"],
];

const actionHeaders: Array<[RblLoma2026HeaderKey, string]> = [
  ["actionSearch", "Searched online"],
  ["actionVisit", "Visited store or location"],
  ["actionDiscuss", "Discussed with someone"],
  ["actionFollow", "Followed on social media"],
  ["actionPurchase", "Purchased product or service"],
  ["actionNone", "Took no action"],
];

const categoryHeaders: Array<[RblLoma2026HeaderKey, string]> = [
  ["categoryTelecoms", "Telecoms"],
  ["categoryBanking", "Banking"],
  ["categoryBetting", "Betting"],
  ["categoryFmcg", "FMCG"],
  ["categoryPolitical", "Political"],
  ["categoryEntertainment", "Entertainment"],
  ["categoryRealEstate", "Real estate"],
  ["categoryFintech", "Fintech"],
  ["categoryHospitality", "Hospitality"],
  ["categoryHousehold", "Household"],
];

function text(value: SurveySpreadsheetCell): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
}

function numberValue(value: SurveySpreadsheetCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function yesNo(value: SurveySpreadsheetCell): boolean | null {
  const normalized = text(value)?.toLocaleLowerCase("en");
  if (!normalized) return null;
  if (normalized === "yes" || normalized.startsWith("yes ") || normalized.startsWith("yes→")) return true;
  if (normalized === "no" || normalized.startsWith("no ") || normalized.startsWith("no→")) return false;
  return null;
}

function selected(value: SurveySpreadsheetCell): boolean {
  if (value === true || value === 1) return true;
  const normalized = text(value)?.toLocaleLowerCase("en");
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function selectedLabels(
  row: readonly SurveySpreadsheetCell[],
  index: RblLoma2026HeaderIndex,
  candidates: Array<[RblLoma2026HeaderKey, string]>,
): string[] {
  return candidates.flatMap(([key, label]) => selected(row[index[key]]) ? [label] : []);
}

function isoDateTime(value: SurveySpreadsheetCell): string | null {
  if (value instanceof Date) return value.toISOString();
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : raw;
}

function appendDiagnostic(
  diagnostics: SurveyRowDiagnostic[],
  code: SurveyRowDiagnostic["code"],
  scope: SurveyRowDiagnostic["scope"],
): void {
  diagnostics.push({ code, scope, severity: "advisory" });
}

export function parseRblLoma2026Response(
  row: readonly SurveySpreadsheetCell[],
  index: RblLoma2026HeaderIndex,
  sourceRowNumber: number,
): CanonicalSurveyResponse {
  const diagnostics: SurveyRowDiagnostic[] = [];
  const city = text(row[index.city]);
  const ageBand = text(row[index.ageBand]);
  const contextEligible =
    yesNo(row[index.consent]) === true &&
    yesNo(row[index.residenceEligible]) === true &&
    city !== null &&
    ageBand !== null &&
    ageBand !== "56+";
  if (!contextEligible) appendDiagnostic(diagnostics, "CONTEXT_SCREEN_NOT_ELIGIBLE", "row");

  const latitude = numberValue(row[index.latitude]);
  const longitude = numberValue(row[index.longitude]);
  if (
    latitude !== null && longitude !== null &&
    !(latitude >= 4 && latitude <= 14.5 && longitude >= 2 && longitude <= 15)
  ) {
    appendDiagnostic(diagnostics, "GPS_OUTSIDE_NIGERIA_BOUNDS", "row");
  }
  const gpsPrecision = numberValue(row[index.gpsPrecision]);
  if (gpsPrecision !== null && gpsPrecision <= 0) {
    appendDiagnostic(diagnostics, "GPS_PRECISION_NONPOSITIVE", "row");
  }

  const collectionStart = isoDateTime(row[index.start]);
  const collectionEnd = isoDateTime(row[index.end]);
  if (collectionStart && collectionEnd) {
    const durationMs = new Date(collectionEnd).getTime() - new Date(collectionStart).getTime();
    if (Number.isFinite(durationMs) && durationMs < 0) {
      appendDiagnostic(diagnostics, "INTERVIEW_DURATION_NEGATIVE", "row");
    }
  }

  const topFormats = selectedLabels(row, index, topFormatHeaders);
  const commuteAttentionTargets = selectedLabels(row, index, commuteAttentionHeaders);
  const attentionDrivers = selectedLabels(row, index, attentionDriverHeaders);
  if (topFormats.length !== 3) appendDiagnostic(diagnostics, "TOP3_FORMAT_COUNT_DIAGNOSTIC", "question");
  if (commuteAttentionTargets.length !== 2) appendDiagnostic(diagnostics, "TOP2_COMMUTE_COUNT_DIAGNOSTIC", "question");
  if (attentionDrivers.length !== 2) appendDiagnostic(diagnostics, "TOP2_DRIVER_COUNT_DIAGNOSTIC", "question");

  const recalledOohLastFourWeeks = yesNo(row[index.recallLastFourWeeks]);
  const recallDetails = [index.recallAbout, index.recallBrand, index.recallWhere]
    .map((position) => text(row[position]));
  const recallDetailComplete = recalledOohLastFourWeeks === null
    ? null
    : recalledOohLastFourWeeks
      ? recallDetails.every((value) => value !== null)
      : recallDetails.every((value) => value === null);
  if (recalledOohLastFourWeeks === false && recallDetails.some((value) => value !== null)) {
    appendDiagnostic(diagnostics, "RECALL_NO_WITH_FOLLOWUP", "question");
  }
  if (recalledOohLastFourWeeks === true && recallDetails.some((value) => value === null)) {
    appendDiagnostic(diagnostics, "RECALL_YES_MISSING_FOLLOWUP", "question");
  }

  const formatRatings: SurveyFormatRatings = {};
  const presentRatings: number[] = [];
  for (const [format, attributes] of Object.entries(formatRatingHeaderKeys) as Array<
    [SurveyFormat, Record<SurveyFormatAttribute, RblLoma2026HeaderKey>]
  >) {
    const formatValues: Partial<Record<SurveyFormatAttribute, number>> = {};
    for (const [attribute, headerKey] of Object.entries(attributes) as Array<
      [SurveyFormatAttribute, RblLoma2026HeaderKey]
    >) {
      const value = numberValue(row[index[headerKey]]);
      if (value !== null && Number.isInteger(value) && value >= 1 && value <= 5) {
        formatValues[attribute] = value;
        presentRatings.push(value);
      }
    }
    formatRatings[format] = formatValues;
  }
  if (presentRatings.length !== 25) {
    appendDiagnostic(diagnostics, "FORMAT_MATRIX_INCOMPLETE", "question");
  } else if (new Set(presentRatings).size === 1) {
    appendDiagnostic(diagnostics, "FORMAT_MATRIX_STRAIGHTLINE", "question");
  }

  const weekdayDayparts = selectedLabels(row, index, [
    ["weekdayMorning", "Morning"],
    ["weekdayAfternoon", "Afternoon"],
    ["weekdayEvening", "Evening"],
    ["weekdayNight", "Night"],
  ]);
  const weekendDayparts = selectedLabels(row, index, [
    ["weekendMorning", "Morning"],
    ["weekendAfternoon", "Afternoon"],
    ["weekendEvening", "Evening"],
    ["weekendNight", "Night"],
  ]);

  return {
    sourceRowNumber,
    contextEligible,
    collectionStart,
    collectionEnd,
    formVersion: text(row[index.formVersion]),
    city,
    ageBand,
    gender: text(row[index.gender]),
    occupation: text(row[index.occupation]),
    incomeBand: text(row[index.incomeBand]),
    transportMode: text(row[index.transportMode]),
    weekdayDayparts,
    weekendDayparts,
    oohAttention: text(row[index.oohAttention]),
    weeklyNoticeFrequency: text(row[index.weeklyNoticeFrequency]),
    recalledOohLastFourWeeks,
    recallDetailComplete,
    primaryOohEnvironment: text(row[index.primaryEnvironment]),
    hardestToIgnoreFormat: text(row[index.hardestToIgnoreFormat]),
    memorabilityDriver: text(row[index.memorabilityDriver]),
    commuteMood: text(row[index.commuteMood]),
    trafficAttention: text(row[index.trafficAttention]),
    bestRoad: text(row[index.bestRoad]),
    bestArea: text(row[index.bestArea]),
    topFormats,
    commuteAttentionTargets,
    attentionDrivers,
    actions: selectedLabels(row, index, actionHeaders),
    responsiveCategories: selectedLabels(row, index, categoryHeaders),
    formatRatings,
    diagnostics,
  };
}

export function parseRblLoma2026Rows(
  headers: readonly string[],
  rows: readonly (readonly SurveySpreadsheetCell[])[],
): CanonicalSurveyResponse[] {
  const index = buildRblLoma2026HeaderIndex(headers);
  return rows.map((row, rowIndex) => parseRblLoma2026Response(row, index, rowIndex + 2));
}
