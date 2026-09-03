import { rblLoma2026Sources } from "@/evidence/sourceCatalog";

export type ReviewedReportEvidence = {
  id: string;
  sourceId: string;
  page: number;
  theme: string;
  metricId: string | null;
  geography: string;
  period: string;
  evidenceType:
    | "methodology"
    | "survey_interpretation"
    | "qualitative_context"
    | "limitation";
  paraphrase: string;
  caveat: string;
  status: "approved" | "blocked";
};

const reportSource = rblLoma2026Sources[1];

/**
 * Human-reviewed, bounded report evidence. Raw PDF text is intentionally kept
 * out of source control, MariaDB, and model retrieval.
 */
export const reportEvidence = [
  {
    id: "report-methods-mixed-design",
    sourceId: reportSource.id,
    page: 31,
    theme: "Mixed-method study design",
    metricId: null,
    geography: "study_coverage",
    period: "2026",
    evidenceType: "methodology",
    paraphrase:
      "The report describes a mixed-method design combining the quantitative city survey with focus groups, in-depth interviews, and key-informant interviews. Survey facts and qualitative context must remain distinguishable in planner answers.",
    caveat:
      "This is the report's methodology description; it does not validate every analytical claim made later in the report.",
    status: "approved",
  },
  {
    id: "report-methods-achieved-sample",
    sourceId: reportSource.id,
    page: 34,
    theme: "Achieved respondent profile",
    metricId: "sample_base",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "limitation",
    paraphrase:
      "The report presents 1,844 achieved interviews across 12 cities and states that screening was applied before full administration.",
    caveat:
      "The pinned workbook contains six explicit screening-close rows and one row without a city, so the governed eligible base is 1,837 rather than the report's full achieved count.",
    status: "blocked",
  },
  {
    id: "report-methods-questionnaire-modules",
    sourceId: reportSource.id,
    page: 35,
    theme: "Questionnaire coverage",
    metricId: null,
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "methodology",
    paraphrase:
      "The questionnaire covers mobility, commuter attention and mood, format visibility, recall, category recall, five-dimension format ratings, and reported post-exposure behaviour.",
    caveat:
      "Only the workbook fields on the reviewed allowlist are normalized; identity, GPS, device, and submission fields are excluded.",
    status: "approved",
  },
  {
    id: "report-commute-mood-context",
    sourceId: reportSource.id,
    page: 47,
    theme: "Commute mood and receptiveness",
    metricId: "commute_mood",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "survey_interpretation",
    paraphrase:
      "The report treats relaxed and alert commute states as useful context for creative complexity and audience receptiveness; planners can compare the underlying self-reported mood distribution by supported city or segment.",
    caveat:
      "Mood is self-reported context, not proof that a particular site or advertisement received attention.",
    status: "approved",
  },
  {
    id: "report-format-hardest-to-ignore",
    sourceId: reportSource.id,
    page: 65,
    theme: "Format salience",
    metricId: "hardest_to_ignore",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "survey_interpretation",
    paraphrase:
      "The report distinguishes formats encountered most often from formats respondents describe as hardest to ignore, allowing planners to separate availability or presence from perceived salience.",
    caveat:
      "Perceived salience is not measured reach, frequency, or site-level delivery.",
    status: "approved",
  },
  {
    id: "report-post-ad-actions",
    sourceId: reportSource.id,
    page: 69,
    theme: "Reported actions after OOH exposure",
    metricId: "reported_post_ad_action",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "survey_interpretation",
    paraphrase:
      "The report presents discussion, online search, product or service trial, location visits, social follows, and no action as a multiple-response portfolio of self-reported behaviours after outdoor advertising exposure.",
    caveat:
      "These are self-reported associations and must not be described as causal conversion, attribution, or ROI.",
    status: "approved",
  },
  {
    id: "report-creative-attention-drivers",
    sourceId: reportSource.id,
    page: 72,
    theme: "Creative attention drivers",
    metricId: "creative_trigger",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "survey_interpretation",
    paraphrase:
      "The report frames screen brightness and size, personal relevance, familiar personalities, entertainment, motion, and local language as multiple-response creative cues respondents say could increase attention.",
    caveat:
      "The responses are stated preferences, not experimental estimates of creative lift.",
    status: "approved",
  },
  {
    id: "report-format-rating-scale",
    sourceId: reportSource.id,
    page: 78,
    theme: "Five-dimension format ratings",
    metricId: "format_attention_rating",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "methodology",
    paraphrase:
      "The report scores five outdoor formats on attention, recall, trust, effectiveness, and quality feel using a 1-to-5 scale. The governed read model publishes each dimension with its valid base and scale.",
    caveat:
      "Mean ratings reflect respondent perception and do not replace audited inventory, price, availability, or delivery data.",
    status: "approved",
  },
  {
    id: "report-four-week-recall-dispute",
    sourceId: reportSource.id,
    page: 59,
    theme: "Four-week OOH recall",
    metricId: "four_week_recall",
    geography: "study_coverage",
    period: "2026-05",
    evidenceType: "limitation",
    paraphrase:
      "The report promotes a four-week national recall benchmark and related city figures as planning evidence.",
    caveat:
      "The report's figures cannot be reproduced consistently from the pinned workbook for key cities, including Lagos; the entire metric family is blocked pending denominator or transformation documentation.",
    status: "blocked",
  },
] as const satisfies readonly ReviewedReportEvidence[];

