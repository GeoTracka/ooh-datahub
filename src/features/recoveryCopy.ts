export type RecoveryCopy = {
  title: string;
  message: string;
};

const packageConstraintCopy: Record<string, RecoveryCopy> = {
  DUPLICATE_SITE: {
    title: "A media location is selected more than once",
    message: "Undo the duplicate selection or choose a different available location.",
  },
  SITE_COUNT_OUTSIDE_3_TO_6: {
    title: "Choose between 3 and 6 media locations",
    message: "Add or remove locations until the package contains between three and six unique locations.",
  },
  EXACTLY_THREE_ZONES_REQUIRED: {
    title: "Keep the package across exactly three areas",
    message: "Adjust the selected locations or replace an area so the package covers exactly three areas.",
  },
  BUDGET_EXCEEDED: {
    title: "This package is over the campaign budget",
    message: "Increase the budget or replace a location with a lower-cost available option.",
  },
  NORMALIZATION_ENVELOPE_EXCEEDED: {
    title: "This package costs too much for a fair comparison",
    message: "Reduce the package cost so it can be compared with the other options using the same budget range.",
  },
  SITE_UNAVAILABLE: {
    title: "A selected media location is unavailable",
    message: "Remove or replace the unavailable location before accepting the package.",
  },
  SITE_UNAVAILABLE_FOR_FLIGHT: {
    title: "A selected media location is unavailable for these campaign dates",
    message: "Change the campaign dates or replace the affected location with an available option.",
  },
};

export function describePackageConstraint(code: string): RecoveryCopy {
  return packageConstraintCopy[code] ?? {
    title: "This package needs attention",
    message: "Review the selected locations, areas, budget, and campaign dates before continuing.",
  };
}

const uploadReasonLabels: Record<string, string> = {
  APPARENT_PERSONAL_DATA: "Possible personal data",
  MISSING_ASSET_ID: "Missing asset ID",
  MISSING_LOCATION: "Missing usable location",
  DUPLICATE_ASSET_ID: "Duplicate asset ID",
};

export function describeUploadReason(code: string): string {
  return uploadReasonLabels[code] ?? "Validation rule not satisfied";
}

export function summarizeReasonCodes(
  rows: Array<{ reasonCodes: string[] }>,
): Array<{ code: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of rows) {
    for (const code of item.reasonCodes) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({ code, label: describeUploadReason(code), count }));
}

export function uploadErrorCopy(kind: "parse" | "provider", technicalCode: string): RecoveryCopy {
  if (kind === "parse") {
    return {
      title: "We couldn't read this spreadsheet",
      message: "Choose a CSV, TSV, or XLSX file with a header row. Nothing from this file has been added to planning.",
    };
  }
  if (technicalCode === "SELECT_AT_LEAST_ONE_ROW") {
    return {
      title: "Select at least one accepted row",
      message: "Choose one or more accepted inventory rows before checking their locations.",
    };
  }
  return {
    title: "Location checking is temporarily unavailable",
    message: "Your uploaded details are still available. You can add them to the map now or retry location checking without uploading the file again.",
  };
}
