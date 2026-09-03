export const RBL_LOMA_CITY_IDS = [
  "lagos",
  "ibadan",
  "benin_city",
  "asaba",
  "port_harcourt",
  "onitsha",
  "enugu",
  "aba",
  "abuja",
  "kaduna",
  "kano",
  "sokoto",
] as const;

export type RblLomaCityId = (typeof RBL_LOMA_CITY_IDS)[number];

export type NormalizedSelections = Readonly<Record<string, string>>;
export type NormalizedRatings = Readonly<Record<string, number>>;

export type NormalizedSurveyRow = {
  rowNumber: number;
  city: RblLomaCityId;
  ageBand: string | null;
  gender: string | null;
  occupation: string | null;
  incomeBand: string | null;
  mobility: {
    travelFrequency: string | null;
    weekdayTime: string | null;
    weekdayTimes: NormalizedSelections;
    primaryTransport: string | null;
    journeyAttention: string | null;
    weeklyEnvironments: NormalizedSelections;
  };
  formats: {
    categoryRecall: NormalizedSelections;
    noticedFrequency: string | null;
    topFormats: NormalizedSelections;
    exposureEnvironment: string | null;
    fourWeekRecall: string | null;
    hardestToIgnore: string | null;
    commuteMood: string | null;
    commuteAttention: NormalizedSelections;
    ratings: NormalizedRatings;
  };
  creative: {
    triggers: NormalizedSelections;
  };
  actions: {
    reported: NormalizedSelections;
  };
  /** Restricted staging only. Publication code must remove or reject this field. */
  restrictedOpenText: {
    route: string | null;
    area: string | null;
  };
};

export type NormalizeResult =
  | { kind: "accepted"; row: NormalizedSurveyRow }
  | {
      kind: "quarantined";
      rowNumber: number;
      reason:
        | "missing_city"
        | "unknown_city"
        | "not_resident_or_regular_commuter";
    };

