export type RecoveryCopy = {
  title: string;
  message: string;
};

const packageConstraintCopy: Record<string, RecoveryCopy> = {
  DUPLICATE_SITE: {
    title: "A face is selected more than once",
    message: "Undo the duplicate selection or replace it with a different eligible face.",
  },
  SITE_COUNT_OUTSIDE_3_TO_6: {
    title: "Choose between 3 and 6 faces",
    message: "Add or remove faces until the package contains between three and six unique faces.",
  },
  EXACTLY_THREE_ZONES_REQUIRED: {
    title: "Keep the package across exactly three zones",
    message: "Adjust the selected faces or replace a zone so the package covers exactly three zones.",
  },
  BUDGET_EXCEEDED: {
    title: "This package is over the campaign budget",
    message: "Increase the budget or remove or replace a face with a lower-cost eligible option.",
  },
  NORMALIZATION_ENVELOPE_EXCEEDED: {
    title: "This package is outside the planning comparison envelope",
    message: "Reduce package cost so the recommendation can be compared on the same planning basis.",
  },
  SITE_UNAVAILABLE: {
    title: "A selected face is unavailable",
    message: "Remove or replace the unavailable face before accepting the package.",
  },
  SITE_UNAVAILABLE_FOR_FLIGHT: {
    title: "A selected face is unavailable for these campaign dates",
    message: "Change the flight dates or replace the affected face with an available option.",
  },
};

export function describePackageConstraint(code: string): RecoveryCopy {
  return packageConstraintCopy[code] ?? {
    title: "This package needs attention",
    message: "Review the selected faces, zones, budget, and campaign dates before continuing.",
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
      message: "Choose one or more accepted inventory rows before requesting enrichment.",
    };
  }
  return {
    title: "Location enrichment is temporarily unavailable",
    message: "Your uploaded facts are still available offline. You can use them as context now or retry enrichment without re-uploading the file.",
  };
}
