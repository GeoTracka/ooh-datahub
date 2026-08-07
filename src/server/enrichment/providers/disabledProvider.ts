export const disabledCapabilities = {
  placesAggregate: {
    enabled: false,
    reason: "LEGAL_AND_COMMERCIAL_APPROVAL_REQUIRED",
  },
  routes: {
    enabled: false,
    reason: "DISPLAY_CONTEXT_APPROVAL_REQUIRED",
  },
} as const;
