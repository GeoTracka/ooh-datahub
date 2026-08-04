export const DEMO_NOW_ISO = "2026-08-03T12:00:00.000Z";

export type Clock = { nowIso(): string };

export const fixedDemoClock: Clock = {
  nowIso: () => DEMO_NOW_ISO,
};
