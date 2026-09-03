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
    ownerUserId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    title: varchar({ length: 80 }).notNull(),
    status: mysqlEnum(["active", "archived"] as const).notNull().default("active"),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("ai_threads_owner_updated_idx").on(table.ownerUserId, table.updatedAt)],
);

export const aiMessages = mysqlTable(
  "ai_messages",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    threadId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: mysqlEnum(["user", "assistant"] as const).notNull(),
    sequenceNumber: int({ unsigned: true }).notNull(),
    content: json().$type<MessageContent>().notNull(),
    providerResponseId: varchar({ length: 255 }),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
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
    threadId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade", onUpdate: "cascade" }),
    assistantMessageId: binaryBuffer({ length: 16 }).references(() => aiMessages.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    providerCallId: varchar({ length: 255 }).notNull(),
    toolName: varchar({ length: 96 }).notNull(),
    argumentsJson: json().$type<Record<string, unknown>>().notNull(),
    outputJson: json().$type<unknown>(),
    status: mysqlEnum(["running", "completed", "failed", "cancelled"] as const)
      .notNull()
      .default("running"),
    durationMs: int({ unsigned: true }),
    errorCode: varchar({ length: 96 }),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp({ mode: "date" }),
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
    userId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    threadId: binaryBuffer({ length: 16 }).references(() => aiThreads.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    provider: varchar({ length: 32 }).notNull(),
    model: varchar({ length: 96 }).notNull(),
    inputTokens: int({ unsigned: true }).notNull().default(0),
    outputTokens: int({ unsigned: true }).notNull().default(0),
    totalTokens: int({ unsigned: true }).notNull().default(0),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("ai_usage_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const aiRateLimits = mysqlTable(
  "ai_rate_limits",
  {
    userId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade", onUpdate: "cascade" }),
    scope: varchar({ length: 48 }).notNull(),
    windowStartedAt: timestamp({ mode: "date" }).notNull(),
    requestCount: int({ unsigned: true }).notNull().default(0),
    updatedAt: timestamp({ mode: "date" }).notNull().defaultNow().onUpdateNow(),
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
