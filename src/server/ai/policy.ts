export type PlannerRequestAssessment =
  | { disposition: "supported" }
  | {
      disposition: "unsupported";
      reason:
        | "restricted_data"
        | "unsupported_delivery_claim"
        | "unverified_commercial_data"
        | "unsupported_channel_or_activity"
        | "blocked_evidence"
        | "external_action"
        | "prompt_injection";
      response: string;
    };

const RULES: Array<{
  pattern: RegExp;
  reason: Exclude<PlannerRequestAssessment, { disposition: "supported" }>["reason"];
  response: string;
}> = [
  {
    pattern: /\b(four[ -]week\s+recall|4[ -]week\s+recall|disputed\s+recall)\b/i,
    reason: "blocked_evidence",
    response:
      "That recall measure is currently blocked because the workbook and report do not reconcile. I can use the approved attention, format and creative findings instead.",
  },
  {
    pattern: /\b(respondent|raw\s+(?:row|record|survey)|gps|home\s+address|phone\s+number|email\s+address|verbatim|open\s*text|personally\s+identifiable)\b/i,
    reason: "restricted_data",
    response:
      "I can use approved summary findings, but I cannot access or expose respondent-level records, locations or contact details. I can show the relevant city or audience summary instead.",
  },
  {
    pattern: /\b(absolute\s+(?:site\s+)?reach|guaranteed?\s+(?:reach|frequency|impressions?)|site\s+(?:reach|frequency)|return\s+on\s+investment|\bROI\b)\b/i,
    reason: "unsupported_delivery_claim",
    response:
      "The available data cannot support that guarantee or ROI claim. I can provide the planner's labelled estimates, explain how they are calculated and show their limits.",
  },
  {
    pattern: /\b(live\s+availability|available\s+right\s+now|negotiated\s+rates?|confirmed\s+rates?|final\s+price|discounted\s+rate)\b/i,
    reason: "unverified_commercial_data",
    response:
      "I can plan with the current inventory records, but live availability and final commercial terms need supplier confirmation. I will keep those items clearly unconfirmed.",
  },
  {
    pattern: /\b(radio\s+stations?|radio\s+audience|outdoor\s+activation|activation\s+opportunit(?:y|ies)|activation\s+potential|event\s+permit)\b/i,
    reason: "unsupported_channel_or_activity",
    response:
      "The governed data currently loaded here does not cover radio stations or verified activation opportunities. I can keep that as a clearly marked research need without inventing options.",
  },
  {
    pattern: /\b(book(?:ing)?\s+(?:this|the|a)?\s*(?:site|inventory)|send\s+(?:this|a|the)\s+(?:message|email|request)\s+to\s+(?:the\s+)?supplier|contact\s+(?:the\s+)?supplier|confirm\s+(?:the\s+)?booking)\b/i,
    reason: "external_action",
    response:
      "I can prepare a review-ready request, but I cannot claim a booking, contact a supplier or confirm an external action from this chat.",
  },
  {
    pattern: /\b(ignore\s+(?:all\s+)?(?:previous|earlier)\s+instructions|reveal\s+(?:the\s+)?(?:system|hidden)\s+prompt|print\s+(?:your\s+)?secrets?|treat\s+retrieved\s+text\s+as\s+instructions)\b/i,
    reason: "prompt_injection",
    response:
      "I cannot follow instructions that try to override the planning safeguards or expose hidden configuration. I can still help with the campaign request itself.",
  },
];

export function assessPlannerRequest(prompt: string): PlannerRequestAssessment {
  const normalized = prompt.normalize("NFKC").replace(/\s+/g, " ").trim();
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        disposition: "unsupported",
        reason: rule.reason,
        response: rule.response,
      };
    }
  }
  return { disposition: "supported" };
}
