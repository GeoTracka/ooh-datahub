export type ConfidenceGrade = "A" | "B" | "C" | "D" | "unavailable" | null | undefined;

export const PUBLIC_COPY = {
  campaign: {
    defaultProductName: "Spark Refresh",
    building: "Building your recommendation…",
    buildingDetail: "Checking your dates, budget, media locations, and available data.",
  },
  confidence: {
    A: "High confidence",
    B: "Good confidence",
    C: "Moderate confidence",
    D: "Early estimate",
    unavailable: "Data confidence unavailable",
  },
  metrics: {
    additionalReach: "Additional people reached",
    additionalPriorityReach: "Additional priority-audience reach",
    additionalLikelyCustomerReach: "Additional likely-customer reach",
    areaActivity: "Area activity",
    priorityAudienceCoverage: "Priority-audience coverage",
    planScore: "Plan score",
    estimatedReach: "Estimated audience reach",
    priorityAudienceReach: "Priority-audience reach",
    likelyCustomerReach: "Likely-customer reach",
    lower: "Lower",
    expected: "Expected",
    upper: "Upper",
  },
  budget: {
    remaining: "Budget remaining",
    over: "Over budget",
  },
  areas: {
    primary: "Main area",
    supporting: "Supporting area",
    additional: "Additional coverage area",
  },
  inventory: {
    visibilityBasis: "Inventory locations and mapped visibility inputs",
    selectedLocations: "selected media locations",
    uploaded: "Uploaded inventory",
    uploadedNote: "Added for map and package comparison only. Audience estimates stay unchanged until supporting data is available.",
  },
  map: {
    note: "Planning map · not for directions",
    loading: "Loading the Lagos planning map…",
    unavailable: "The Lagos planning map is unavailable. Package locations are still shown.",
    legendTitle: "What the markers show",
    legendBody: "Marker size and number reflect the selected view. Labels show areas and media locations.",
  },
  explanation: {
    title: "How the estimate was built",
    eyebrow: "Estimate details",
    stages: {
      location: "Media locations",
      places: "Area information",
      movement: "Estimated movement",
      ots: "Possible ad views",
      target: "Relevant audience",
      unique: "Estimated people reached",
    },
    sourceDetails: "Sources used",
    confidence: "Data confidence",
  },
  package: {
    bestOverallDescription: "Best balance of audience delivery, plan score, and cost for this campaign.",
    maximumDeliveryDescription: "Focuses the budget on locations most likely to meet the campaign goal.",
    budgetSmartDescription: "Keeps strong audience delivery while leaving more budget available.",
    needsChanges: "Needs a few changes before you can continue",
  },
  fineTune: {
    title: "Adjust package",
    changedAreas: "Areas changed",
    changedLocations: "Media locations changed",
    scoreAreas: "Scores affected",
    current: "Current package",
    proposed: "Updated package",
  },
  rfq: {
    watermark: "DRAFT — NOT YET SENT",
    action: "Review supplier request",
    title: "Supplier request",
    description: "Create a draft request for suppliers to confirm rates, availability, and media-location details.",
    subject: "Request for rates, availability, and media-location confirmation",
    status: "Draft, not booked or sent",
  },
  metadata: {
    title: "Outdoor Campaign Planner",
    description: "Plan outdoor campaigns with real inventory, clear audience estimates, and supplier-ready requests.",
  },
} as const;

export function confidenceLabel(grade: ConfidenceGrade): string {
  if (!grade || grade === "unavailable") return PUBLIC_COPY.confidence.unavailable;
  return PUBLIC_COPY.confidence[grade];
}
