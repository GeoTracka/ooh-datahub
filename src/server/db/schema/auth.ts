import {
  index,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { binaryBuffer } from "@/server/db/schema/types";

export const appUsers = mysqlTable(
  "app_users",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    status: mysqlEnum(["active", "disabled"] as const)
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("app_users_email_uq").on(table.email)],
);

export const appSessions = mysqlTable(
  "app_sessions",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    tokenHash: binaryBuffer("token_hash", { length: 32 }).notNull(),
    userId: binaryBuffer("user_id", { length: 16 })
      .notNull()
      .references(() => appUsers.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).notNull().defaultNow(),
    ipHash: binaryBuffer("ip_hash", { length: 32 }),
    userAgentHash: binaryBuffer("user_agent_hash", { length: 32 }),
  },
  (table) => [
    uniqueIndex("app_sessions_token_hash_uq").on(table.tokenHash),
    index("app_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);
