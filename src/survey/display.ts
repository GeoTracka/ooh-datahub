export const SURVEY_CONTEXT_BOUNDARY_COPY =
  "Self-reported consumer research. It is not observed movement, exposure geometry, OTS, reach, frequency, unique reach, target share, influence, Planning Fit, or calibration evidence.";

function dateParts(value: string): {
  day: string;
  month: string;
  year: string;
} {
  const date = new Date(`${value}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

export function surveyPeriodLabel(period: {
  start: string;
  end: string;
}): string {
  const start = dateParts(period.start);
  const end = dateParts(period.end);
  if (start.year === end.year) {
    return `${start.day} ${start.month}–${end.day} ${end.month} ${end.year}`;
  }
  return `${start.day} ${start.month} ${start.year}–${end.day} ${end.month} ${end.year}`;
}
