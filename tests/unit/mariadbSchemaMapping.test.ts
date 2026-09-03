import { getTableColumns } from "drizzle-orm";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";

import {
  aiMessages,
  aiRateLimits,
  aiThreads,
  aiToolRuns,
  aiUsageEvents,
  appSessions,
  appUsers,
  artifactCitations,
  campaignArtifactRevisions,
  campaignArtifacts,
  evidenceCitations,
  evidenceDisputes,
  evidenceExcerpts,
  evidenceFacts,
  evidenceMetrics,
  evidenceSources,
} from "@/server/db/schema";

const expectedColumns: Array<readonly [AnyMySqlTable, readonly string[]]> = [
  [appUsers, ["id", "email", "display_name", "password_hash", "status", "created_at", "updated_at"]],
  [appSessions, ["id", "token_hash", "user_id", "expires_at", "created_at", "last_seen_at", "ip_hash", "user_agent_hash"]],
  [aiThreads, ["id", "owner_user_id", "title", "status", "created_at", "updated_at"]],
  [aiMessages, ["id", "thread_id", "role", "sequence_number", "content", "provider_response_id", "created_at"]],
  [aiToolRuns, ["id", "thread_id", "assistant_message_id", "provider_call_id", "tool_name", "arguments_json", "output_json", "status", "duration_ms", "error_code", "created_at", "completed_at"]],
  [aiUsageEvents, ["id", "user_id", "thread_id", "provider", "model", "input_tokens", "output_tokens", "total_tokens", "created_at"]],
  [aiRateLimits, ["user_id", "scope", "window_started_at", "request_count", "updated_at"]],
  [campaignArtifacts, ["id", "owner_user_id", "thread_id", "type", "save_state", "current_revision_number", "created_at", "updated_at"]],
  [campaignArtifactRevisions, ["artifact_id", "revision_number", "parent_revision_number", "created_by_user_id", "payload", "reason", "created_at"]],
  [artifactCitations, ["id", "artifact_id", "revision_number", "fact_id", "excerpt_id", "created_at"]],
  [evidenceSources, ["id", "kind", "file_name", "sha256", "access_class", "period", "status", "published_at"]],
  [evidenceMetrics, ["id", "family", "label", "unit", "status"]],
  [evidenceFacts, ["id", "source_id", "metric_id", "label", "value", "unit", "numerator", "denominator", "respondent_base", "valid_base", "selection_count", "geography_id", "segment_hash", "segment", "period", "weighting", "source_column", "status", "published_at"]],
  [evidenceCitations, ["id", "fact_id", "source_id", "workbook_field", "page", "caveat"]],
  [evidenceDisputes, ["id", "source_id", "metric_id", "status", "workbook_value", "report_value", "note"]],
  [evidenceExcerpts, ["id", "source_id", "metric_id", "page", "theme", "geography_id", "period", "evidence_type", "paraphrase", "caveat", "status"]],
];

describe("MariaDB schema mappings", () => {
  it("maps every runtime column to its migrated snake_case name", () => {
    for (const [table, expected] of expectedColumns) {
      expect(Object.values(getTableColumns(table)).map((column) => column.name)).toEqual(expected);
    }
  });
});
