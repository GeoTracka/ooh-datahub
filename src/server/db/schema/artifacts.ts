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

import type { ArtifactPayload } from "@/server/artifacts/contracts";
import { appUsers } from "@/server/db/schema/auth";
import { aiThreads } from "@/server/db/schema/ai";
import { binaryBuffer } from "@/server/db/schema/types";
import { evidenceExcerpts, evidenceFacts } from "@/server/db/schema/evidence";

export const campaignArtifacts = mysqlTable(
  "campaign_artifacts",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    ownerUserId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    threadId: binaryBuffer({ length: 16 }).references(() => aiThreads.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    type: mysqlEnum(["plan", "map", "audience", "evidence"] as const).notNull(),
    saveState: mysqlEnum(["draft", "saved"] as const).notNull().default("draft"),
    currentRevisionNumber: int({ unsigned: true }).notNull(),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("campaign_artifacts_owner_updated_idx").on(table.ownerUserId, table.updatedAt),
    index("campaign_artifacts_thread_idx").on(table.threadId),
  ],
);

export const campaignArtifactRevisions = mysqlTable(
  "campaign_artifact_revisions",
  {
    artifactId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => campaignArtifacts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    revisionNumber: int({ unsigned: true }).notNull(),
    parentRevisionNumber: int({ unsigned: true }),
    createdByUserId: binaryBuffer({ length: 16 })
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    payload: json().$type<ArtifactPayload>().notNull(),
    reason: varchar({ length: 240 }).notNull(),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.artifactId, table.revisionNumber] }),
    index("campaign_artifact_revisions_created_idx").on(table.createdAt),
  ],
);

export const artifactCitations = mysqlTable(
  "artifact_citations",
  {
    id: binaryBuffer({ length: 16 }).primaryKey(),
    artifactId: binaryBuffer({ length: 16 }).notNull(),
    revisionNumber: int({ unsigned: true }).notNull(),
    factId: varchar({ length: 255 }).references(() => evidenceFacts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    excerptId: varchar({ length: 160 }).references(() => evidenceExcerpts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    createdAt: timestamp({ mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("artifact_citations_fact_uq").on(
      table.artifactId,
      table.revisionNumber,
      table.factId,
    ),
    uniqueIndex("artifact_citations_excerpt_uq").on(
      table.artifactId,
      table.revisionNumber,
      table.excerptId,
    ),
    index("artifact_citations_revision_idx").on(table.artifactId, table.revisionNumber),
  ],
);

export const artifactSchema = {
  campaignArtifacts,
  campaignArtifactRevisions,
  artifactCitations,
};
