import type { Daypart } from "@/contracts/domain";

export function passageEvents(baseMovement: number, multiplier: number): number {
  if (baseMovement < 0 || multiplier <= 0) throw new Error("Invalid movement input");
  return baseMovement * multiplier;
}

export function inclusiveFlightDays(start: string, end: string): number {
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error("INVALID_FLIGHT_DATES");
  }
  const days = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (days > 366) throw new Error("FLIGHT_OUTSIDE_MVP_ENVELOPE");
  return days;
}

export function siteDeliveryCompatible(
  site: {
    available: boolean;
    deliverySchedule: { availabilityStart: string; availabilityEnd: string };
  },
  flightStart: string,
  flightEnd: string,
): boolean {
  return site.available &&
    site.deliverySchedule.availabilityStart <= flightStart &&
    site.deliverySchedule.availabilityEnd >= flightEnd;
}

export type ExposureBlock = {
  date: string;
  daypart: Exclude<Daypart, "all_day">;
  startMinute: number;
  endMinute: number;
  durationHours: number;
};

const windows: Record<ExposureBlock["daypart"], [number, number]> = {
  am: [360, 600],
  midday: [600, 900],
  pm: [900, 1140],
  evening: [1140, 1380],
};

export function materializeExposureBlocks(
  start: string,
  end: string,
  requestedDaypart: Daypart,
): ExposureBlock[] {
  const days = inclusiveFlightDays(start, end);
  const startMs = Date.parse(start + "T00:00:00Z");
  const dayparts: ExposureBlock["daypart"][] = requestedDaypart === "all_day"
    ? ["am", "midday", "pm", "evening"]
    : [requestedDaypart];
  return Array.from({ length: days }, (_, dayIndex) =>
    dayparts.map((daypart) => {
      const [startMinute, endMinute] = windows[daypart];
      return {
        date: new Date(startMs + dayIndex * 86_400_000).toISOString().slice(0, 10),
        daypart,
        startMinute,
        endMinute,
        durationHours: (endMinute - startMinute) / 60,
      };
    }),
  ).flat();
}
