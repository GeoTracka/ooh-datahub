import { z } from "zod";

import {
  CompareCitiesArgsSchema,
  ExplainPlanMetricArgsSchema,
  GetCityProfileArgsSchema,
  GetCreativeGuidanceArgsSchema,
  GetFormatScoresArgsSchema,
  GetMobilityContextArgsSchema,
  SearchEvidenceArgsSchema,
} from "@/server/ai/tools/contracts";
import type { EvidenceTools } from "@/server/ai/tools/evidenceTools";

type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};

type ToolEntry = {
  definition: ToolDefinition;
  execute(argumentsJson: string): Promise<unknown>;
};

function entry<TSchema extends z.ZodType>(
  name: string,
  description: string,
  schema: TSchema,
  handler: (args: z.infer<TSchema>) => Promise<unknown>,
): ToolEntry {
  return {
    definition: {
      type: "function",
      name,
      description,
      parameters: z.toJSONSchema(schema) as Record<string, unknown>,
      strict: true,
    },
    async execute(argumentsJson) {
      const parsedJson: unknown = JSON.parse(argumentsJson);
      return handler(schema.parse(parsedJson));
    },
  };
}

export function createEvidenceToolRegistry(tools: EvidenceTools) {
  const entries = [
    entry("search_evidence", "Find governed study evidence for a supported plain-language topic.", SearchEvidenceArgsSchema, tools.searchEvidence),
    entry("get_city_profile", "Get a bounded attention, mobility, format and creative profile for one study city.", GetCityProfileArgsSchema, tools.getCityProfile),
    entry("compare_cities", "Compare two to five study cities on one supported topic.", CompareCitiesArgsSchema, tools.compareCities),
    entry("get_format_scores", "Get valid five-point study ratings for supported outdoor formats.", GetFormatScoresArgsSchema, tools.getFormatScores),
    entry("get_mobility_context", "Get travel frequency and usual transport findings for study cities.", GetMobilityContextArgsSchema, tools.getMobilityContext),
    entry("get_creative_guidance", "Get reported creative features that may attract attention.", GetCreativeGuidanceArgsSchema, tools.getCreativeGuidance),
    entry("explain_plan_metric", "Explain a planner metric and its limits in plain language.", ExplainPlanMetricArgsSchema, tools.explainPlanMetric),
  ];
  return {
    definitions: entries.map((value) => value.definition),
    byName: new Map(entries.map((value) => [value.definition.name, value])),
    async execute(name: string, argumentsJson: string) {
      const selected = entries.find((value) => value.definition.name === name);
      if (!selected) throw new Error(`UNKNOWN_TOOL:${name}`);
      return selected.execute(argumentsJson);
    },
  };
}
