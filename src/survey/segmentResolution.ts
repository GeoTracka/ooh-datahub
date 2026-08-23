import type { Brief } from "@/contracts/domain";
import {
  surveySegmentPredicateLabel,
  type SurveySegmentCatalogue,
  type SurveySegmentDimension,
  type SurveySegmentProfile,
} from "@/survey/segmentCatalogue";

export const SURVEY_SEGMENT_RESOLUTION_POLICY =
  "first_available_rule_in_declared_precedence" as const;

export type SurveySegmentResolutionMode =
  | "matched"
  | "matched_after_suppression"
  | "fallback_no_match"
  | "fallback_suppressed";

export type SurveySegmentResolution = {
  mode: SurveySegmentResolutionMode;
  policy: typeof SURVEY_SEGMENT_RESOLUTION_POLICY;
  selectedProfileId: string | null;
  selectedLabel: string;
  selectedPredicateLabel: string | null;
  selectedSampleSize: number;
  requestedPredicateLabel: string | null;
  matchedTerms: string[];
  matchedRuleIds: string[];
  unavailablePredicateLabels: string[];
  explanation: string;
};

type SegmentCandidate = {
  dimension: SurveySegmentDimension;
  value: string;
};

type SegmentRule = {
  id: string;
  terms: string[];
  candidates: SegmentCandidate[];
};

const segmentRules: SegmentRule[] = [
  {
    id: "explicit-age-18-25",
    terms: ["18-25", "18 to 25", "aged 18 to 25"],
    candidates: [{ dimension: "ageBand", value: "18-25" }],
  },
  {
    id: "explicit-age-26-35",
    terms: ["26-35", "26 to 35", "aged 26 to 35"],
    candidates: [{ dimension: "ageBand", value: "26-35" }],
  },
  {
    id: "explicit-age-36-45",
    terms: ["36-45", "36 to 45", "aged 36 to 45"],
    candidates: [{ dimension: "ageBand", value: "36-45" }],
  },
  {
    id: "explicit-age-46-55",
    terms: ["46-55", "46 to 55", "aged 46 to 55"],
    candidates: [{ dimension: "ageBand", value: "46-55" }],
  },
  {
    id: "high-income",
    terms: [
      "affluent",
      "high income",
      "wealthy",
      "premium buyers",
      "luxury buyers",
    ],
    candidates: [
      { dimension: "incomeBand", value: "₦500,000 and above" },
      { dimension: "incomeBand", value: "₦200,000–₦499,999" },
    ],
  },
  {
    id: "mid-income",
    terms: [
      "middle income",
      "mid income",
      "100,000 to 199,999",
      "100000 to 199999",
    ],
    candidates: [{ dimension: "incomeBand", value: "₦100,000–₦199,999" }],
  },
  {
    id: "lower-income",
    terms: ["lower income", "low income", "below 100,000", "below 100000"],
    candidates: [
      { dimension: "incomeBand", value: "Below ₦50,000" },
      { dimension: "incomeBand", value: "₦50,000–₦99,999" },
    ],
  },
  {
    id: "students-and-youth",
    terms: ["student", "students", "campus", "university", "youth"],
    candidates: [
      { dimension: "occupation", value: "Student" },
      { dimension: "ageBand", value: "18-25" },
    ],
  },
  {
    id: "business-owners-and-traders",
    terms: [
      "sme owner",
      "sme owners",
      "merchant",
      "merchants",
      "business owner",
      "business owners",
      "trader",
      "traders",
      "retailer",
      "retailers",
      "entrepreneur",
      "entrepreneurs",
      "investor",
      "investors",
    ],
    candidates: [{ dimension: "occupation", value: "Business/trader" }],
  },
  {
    id: "young-professionals",
    terms: [
      "young worker",
      "young workers",
      "young professional",
      "young professionals",
    ],
    candidates: [
      { dimension: "occupation", value: "Employed professional" },
      { dimension: "ageBand", value: "26-35" },
    ],
  },
  {
    id: "employed-professionals",
    terms: [
      "employed professional",
      "professional",
      "professionals",
      "salaried",
      "executive",
      "executives",
      "corporate",
    ],
    candidates: [{ dimension: "occupation", value: "Employed professional" }],
  },
  {
    id: "artisans-and-skilled-workers",
    terms: ["artisan", "artisans", "skilled worker", "skilled workers"],
    candidates: [{ dimension: "occupation", value: "Artisan/skilled worker" }],
  },
  {
    id: "private-car-users",
    terms: ["private car", "motorist", "motorists", "car commuters"],
    candidates: [{ dimension: "transportMode", value: "Private car" }],
  },
  {
    id: "bus-and-brt-users",
    terms: ["brt", "bus commuter", "bus commuters", "bus users"],
    candidates: [{ dimension: "transportMode", value: "Bus or BRT" }],
  },
  {
    id: "danfo-users",
    terms: ["danfo", "danfo users", "danfo commuters"],
    candidates: [{ dimension: "transportMode", value: "Danfo" }],
  },
  {
    id: "keke-users",
    terms: ["keke", "tricycle", "tricycle users"],
    candidates: [{ dimension: "transportMode", value: "tricycle (Keke)" }],
  },
  {
    id: "ride-hailing-users",
    terms: ["ride hailing", "ride-hailing", "uber", "bolt"],
    candidates: [{ dimension: "transportMode", value: "Ride hailing" }],
  },
  {
    id: "daily-commuters",
    terms: ["daily commuter", "daily commuters"],
    candidates: [{ dimension: "commutePattern", value: "Daily commuter" }],
  },
  {
    id: "hybrid-commuters",
    terms: ["hybrid worker", "hybrid workers", "hybrid commuter"],
    candidates: [{ dimension: "commutePattern", value: "Hybrid" }],
  },
  {
    id: "remote-workers",
    terms: ["remote worker", "remote workers", "work from home"],
    candidates: [{ dimension: "commutePattern", value: "Remote" }],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[₦,–—-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function surveyAudienceLensBasisKey(
  brief: Pick<Brief, "targetAudience" | "productDescription" | "sector">,
): string {
  return [
    brief.sector,
    normalize(brief.targetAudience),
    normalize(brief.productDescription),
  ].join("\u0000");
}

function matchedTerms(text: string, terms: readonly string[]): string[] {
  const searchable = ` ${text} `;
  return terms.filter((term) => searchable.includes(` ${normalize(term)} `));
}

function candidateKey(candidate: SegmentCandidate): string {
  return `${candidate.dimension}\u0000${candidate.value}`;
}

function profileKey(profile: SurveySegmentProfile): string {
  return candidateKey(profile);
}

export function resolveSurveySegment(input: {
  catalogue: SurveySegmentCatalogue;
  fallbackSampleSize: number;
  brief: Pick<Brief, "targetAudience" | "productDescription" | "sector">;
}): SurveySegmentResolution {
  const text = normalize(
    `${input.brief.targetAudience} ${input.brief.productDescription}`,
  );
  const matched = segmentRules.flatMap((rule) => {
    const terms = matchedTerms(text, rule.terms);
    return terms.length > 0 ? [{ rule, terms }] : [];
  });
  const profileByKey = new Map(
    input.catalogue.profiles.map((profile) => [profileKey(profile), profile]),
  );
  const seen = new Set<string>();
  const candidates = matched.flatMap(({ rule, terms }) =>
    rule.candidates.flatMap((candidate) => {
      const key = candidateKey(candidate);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ candidate, ruleId: rule.id, terms }];
    }),
  );
  const selectedIndex = candidates.findIndex(({ candidate }) =>
    profileByKey.has(candidateKey(candidate)),
  );
  const requested = candidates[0]?.candidate ?? null;
  const allMatchedTerms = [...new Set(matched.flatMap(({ terms }) => terms))];
  const matchedRuleIds = [...new Set(matched.map(({ rule }) => rule.id))];

  if (selectedIndex >= 0) {
    const selectedCandidate = candidates[selectedIndex].candidate;
    const selectedProfile = profileByKey.get(candidateKey(selectedCandidate))!;
    const unavailablePredicateLabels = candidates
      .slice(0, selectedIndex)
      .map(({ candidate }) =>
        surveySegmentPredicateLabel(candidate.dimension, candidate.value),
      );
    const mode = selectedIndex === 0 ? "matched" : "matched_after_suppression";
    const explanation =
      mode === "matched"
        ? `Matched the campaign brief to ${selectedProfile.predicateLabel}.`
        : `${unavailablePredicateLabels.join(", ")} did not clear the minimum sample of ${input.catalogue.minimumSampleSize}; using the next available matched predicate, ${selectedProfile.predicateLabel}.`;
    return {
      mode,
      policy: SURVEY_SEGMENT_RESOLUTION_POLICY,
      selectedProfileId: selectedProfile.id,
      selectedLabel: selectedProfile.label,
      selectedPredicateLabel: selectedProfile.predicateLabel,
      selectedSampleSize: selectedProfile.sampleSize,
      requestedPredicateLabel: requested
        ? surveySegmentPredicateLabel(requested.dimension, requested.value)
        : null,
      matchedTerms: allMatchedTerms,
      matchedRuleIds,
      unavailablePredicateLabels,
      explanation,
    };
  }

  if (candidates.length > 0) {
    const unavailablePredicateLabels = candidates.map(({ candidate }) =>
      surveySegmentPredicateLabel(candidate.dimension, candidate.value),
    );
    return {
      mode: "fallback_suppressed",
      policy: SURVEY_SEGMENT_RESOLUTION_POLICY,
      selectedProfileId: null,
      selectedLabel: `All ${input.catalogue.city} respondents`,
      selectedPredicateLabel: null,
      selectedSampleSize: input.fallbackSampleSize,
      requestedPredicateLabel: requested
        ? surveySegmentPredicateLabel(requested.dimension, requested.value)
        : null,
      matchedTerms: allMatchedTerms,
      matchedRuleIds,
      unavailablePredicateLabels,
      explanation: `${unavailablePredicateLabels.join(", ")} did not clear the minimum sample of ${input.catalogue.minimumSampleSize}; using the broader ${input.catalogue.city} sample.`,
    };
  }

  return {
    mode: "fallback_no_match",
    policy: SURVEY_SEGMENT_RESOLUTION_POLICY,
    selectedProfileId: null,
    selectedLabel: `All ${input.catalogue.city} respondents`,
    selectedPredicateLabel: null,
    selectedSampleSize: input.fallbackSampleSize,
    requestedPredicateLabel: null,
    matchedTerms: [],
    matchedRuleIds: [],
    unavailablePredicateLabels: [],
    explanation:
      "No supported age, occupation, income, transport, or mobility terms were found; using the broader city sample.",
  };
}

export function selectedSurveySegmentProfile(input: {
  catalogue: SurveySegmentCatalogue;
  resolution: SurveySegmentResolution;
}): SurveySegmentProfile | null {
  if (!input.resolution.selectedProfileId) return null;
  return (
    input.catalogue.profiles.find(
      ({ id }) => id === input.resolution.selectedProfileId,
    ) ?? null
  );
}
