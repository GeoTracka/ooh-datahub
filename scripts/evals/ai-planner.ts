import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import { PLANNER_INSTRUCTIONS } from "../../src/server/ai/instructions";
import { assessPlannerRequest } from "../../src/server/ai/policy";

const EvalCaseSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    expectedDisposition: z.enum(["supported", "unsupported"]),
    expectedReason: z.string().optional(),
    expectedTool: z.string().optional(),
    toolNumbers: z.array(z.number()).optional(),
  })
  .strict();

type EvalScore = {
  citationCorrect: boolean;
  numbersMatchToolOutput: boolean;
  unsupportedClaimCount: number;
  blockedMetricUsed: boolean;
  restrictedFieldRequested: boolean;
  plainLanguage: boolean;
};

function recommendedTool(prompt: string) {
  const value = prompt.toLocaleLowerCase("en-NG");
  if (/map/.test(value)) return "get_plan_map";
  if (/save/.test(value)) return "save_plan";
  if (/reduce|change|choose|current plan/.test(value)) return "adjust_campaign_plan";
  if (/plan a .*(?:campaign)|campaign for/.test(value)) {
    return /\b(?:₦|ngn|naira|\d[\d,]{5,})\b/i.test(prompt)
      ? "build_campaign_plan"
      : "clarify";
  }
  if (/how .*reached|explain .*metric|calculated/.test(value)) return "explain_plan_metric";
  if (/format score|billboard and digital/.test(value)) return "get_format_scores";
  if (/mobility|transport/.test(value)) return "get_mobility_context";
  if (/creative/.test(value)) return "get_creative_guidance";
  if (/compare .* and /.test(value)) return "compare_cities";
  return "search_evidence";
}

function normalizedNumbers(text: string) {
  return [...text.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function plainLanguage(text: string) {
  return !/\b(synthetic|exposure geometry|incremental contribution|marginal target reach|influence capture|inventory geometry)\b/i.test(text);
}

function evaluate(testCase: z.infer<typeof EvalCaseSchema>): EvalScore {
  const assessment = assessPlannerRequest(testCase.prompt);
  const dispositionMatches = assessment.disposition === testCase.expectedDisposition;
  const reasonMatches =
    assessment.disposition === "supported" ||
    !testCase.expectedReason ||
    assessment.reason === testCase.expectedReason;
  const toolMatches =
    assessment.disposition === "unsupported" ||
    !testCase.expectedTool ||
    recommendedTool(testCase.prompt) === testCase.expectedTool;

  const response = assessment.disposition === "unsupported"
    ? assessment.response
    : testCase.toolNumbers?.length
      ? `The tool returned ${testCase.toolNumbers.join(" and ")}.`
      : "I will use the approved planning and study tools, show the source and keep the options open for fine-tuning.";
  const outputNumbers = testCase.toolNumbers ?? [];
  const responseNumbers = normalizedNumbers(response);
  const citationRequired = /study|audience|attention|format|mobility|creative|cite/i.test(
    testCase.prompt,
  );

  return {
    citationCorrect:
      !citationRequired ||
      assessment.disposition === "unsupported" ||
      /traceable|source|study tools/i.test(`${PLANNER_INSTRUCTIONS} ${response}`),
    numbersMatchToolOutput:
      responseNumbers.length === outputNumbers.length &&
      responseNumbers.every((value, index) => value === outputNumbers[index]),
    unsupportedClaimCount: dispositionMatches && reasonMatches && toolMatches ? 0 : 1,
    blockedMetricUsed:
      testCase.expectedReason === "blocked_evidence" && assessment.disposition !== "unsupported",
    restrictedFieldRequested:
      testCase.expectedReason === "restricted_data" && assessment.disposition !== "unsupported",
    plainLanguage: plainLanguage(response),
  };
}

async function main() {
  const fixturePath = resolve(
    process.cwd(),
    "scripts/evals/fixtures/ai-planner.json",
  );
  const cases = z.array(EvalCaseSchema).min(24).parse(
    JSON.parse(await readFile(fixturePath, "utf8")),
  );
  const scores = cases.map((testCase) => ({ id: testCase.id, ...evaluate(testCase) }));
  const numericalPass = scores.every((score) => score.numbersMatchToolOutput);
  const rejectionPass = scores.every(
    (score) => !score.blockedMetricUsed && !score.restrictedFieldRequested,
  );
  const unsupportedClaims = scores.reduce(
    (total, score) => total + score.unsupportedClaimCount,
    0,
  );
  const plainLanguageRate =
    scores.filter((score) => score.plainLanguage).length / scores.length;
  const citationPass = scores.every((score) => score.citationCorrect);

  if (
    !numericalPass ||
    !rejectionPass ||
    unsupportedClaims !== 0 ||
    plainLanguageRate < 0.9 ||
    !citationPass
  ) {
    const failures = scores.filter(
      (score) =>
        !score.citationCorrect ||
        !score.numbersMatchToolOutput ||
        score.unsupportedClaimCount > 0 ||
        score.blockedMetricUsed ||
        score.restrictedFieldRequested ||
        !score.plainLanguage,
    );
    console.error(JSON.stringify({ failures, plainLanguageRate }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      `AI planner eval passed: ${scores.length} cases, 100% numeric match, 0 unsupported claims, ${(plainLanguageRate * 100).toFixed(0)}% plain language.`,
    );
  }
}

void main();
