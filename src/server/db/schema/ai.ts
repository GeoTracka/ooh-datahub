import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import type { MessageContent } from "@/server/chat/contracts";
import { appUsers } from "@/server/db/schema/auth";
import { binaryBuffer } from "@/server/db/schema/types";

export const aiThreads = mysqlTable(
  "ai_threads",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    ownerUserId: binaryBuffer("owner_user_id", { length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar({ length: 80 }).notNull(),
    status: mysqlEnum(["active", "archived"] as const).notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("ai_threads_owner_updated_idx").on(table.ownerUserId, table.updatedAt)],
);

export const aiMessages = mysqlTable(
  "ai_messages",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    threadId: binaryBuffer("thread_id", { length: 16 })
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: mysqlEnum(["user", "assistant"] as const).notNull(),
    sequenceNumber: int("sequence_number", { unsigned: true }).notNull(),
    content: json().$type<MessageContent>().notNull(),
    providerResponseId: varchar("provider_response_id", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_messages_thread_sequence_uq").on(table.threadId, table.sequenceNumber),
    index("ai_messages_thread_created_idx").on(table.threadId, table.createdAt),
  ],
);

export const aiToolRuns = mysqlTable(
  "ai_tool_runs",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    threadId: binaryBuffer("thread_id", { length: 16 })
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade", onUpdate: "cascade" }),
    assistantMessageId: binaryBuffer("assistant_message_id", { length: 16 }).references(() => aiMessages.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    providerCallId: varchar("provider_call_id", { length: 255 }).notNull(),
    toolName: varchar("tool_name", { length: 96 }).notNull(),
    argumentsJson: json("arguments_json").$type<Record<string, unknown>>().notNull(),
    outputJson: json("output_json").$type<unknown>(),
    status: mysqlEnum(["running", "completed", "failed", "cancelled"] as const)
      .notNull()
      .default("running"),
    durationMs: int("duration_ms", { unsigned: true }),
    errorCode: varchar("error_code", { length: 96 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("ai_tool_runs_provider_call_uq").on(table.threadId, table.providerCallId),
    index("ai_tool_runs_thread_created_idx").on(table.threadId, table.createdAt),
  ],
);

export const aiUsageEvents = mysqlTable(
  "ai_usage_events",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    userId: binaryBuffer("user_id", { length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    threadId: binaryBuffer("thread_id", { length: 16 }).references(() => aiThreads.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    provider: varchar({ length: 32 }).notNull(),
    model: varchar({ length: 96 }).notNull(),
    inputTokens: int("input_tokens", { unsigned: true }).notNull().default(0),
    outputTokens: int("output_tokens", { unsigned: true }).notNull().default(0),
    totalTokens: int("total_tokens", { unsigned: true }).notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("ai_usage_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const aiRateLimits = mysqlTable(
  "ai_rate_limits",
  {
    userId: binaryBuffer("user_id", { length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade", onUpdate: "cascade" }),
    scope: varchar({ length: 48 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { mode: "date" }).notNull(),
    requestCount: int("request_count", { unsigned: true }).notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.scope] })],
);

export const aiSchema = {
  aiThreads,
  aiMessages,
  aiToolRuns,
  aiUsageEvents,
  aiRateLimits,
};
