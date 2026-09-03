import {
  customType,
  index,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const binaryBuffer = customType<{
  data: Buffer;
  driverData: Buffer;
  config: { length: number };
  configRequired: true;
}>({
  dataType: ({ length }) => `binary(${length})`,
  toDriver: (value) => value,
  fromDriver: (value) => Buffer.from(value),
});

export const appUsers = mysqlTable(
  "app_users",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    displayName: varchar({ length: 120 }).notNull(),
    passwordHash: varchar({ length: 255 }).notNull(),
    status: mysqlEnum(["active", "disabled"] as const)
      .notNull()
      .default("active"),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("app_users_email_uq").on(table.email)],
);

export const appSessions = mysqlTable(
  "app_sessions",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    tokenHash: binaryBuffer({ length: 32 }).notNull(),
    userId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    expiresAt: timestamp({ mode: "date" }).notNull(),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    ipHash: binaryBuffer({ length: 32 }),
    userAgentHash: binaryBuffer({ length: 32 }),
  },
  (table) => [
    uniqueIndex("app_sessions_token_hash_uq").on(table.tokenHash),
    index("app_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);
