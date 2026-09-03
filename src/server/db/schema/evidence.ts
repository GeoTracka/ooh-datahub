import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const evidenceStatus = () =>
  mysqlEnum(["approved", "blocked", "superseded"] as const);

export const evidenceSources = mysqlTable(
  "evidence_sources",
  {
    id: varchar({ length: 128 }).primaryKey(),
    kind: mysqlEnum(["survey_workbook", "published_report"] as const).notNull(),
    fileName: varchar({ length: 255 }).notNull(),
    sha256: varchar({ length: 64 }).notNull(),
    accessClass: varchar({ length: 64 }).notNull(),
    period: varchar({ length: 32 }).notNull(),
    status: evidenceStatus().notNull().default("approved"),
    publishedAt: timestamp({ mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("evidence_sources_sha256_uq").on(table.sha256)],
);

export const evidenceMetrics = mysqlTable(
  "evidence_metrics",
  {
    id: varchar({ length: 160 }).primaryKey(),
    family: varchar({ length: 96 }).notNull(),
    label: varchar({ length: 255 }).notNull(),
    unit: varchar({ length: 32 }).notNull(),
    status: evidenceStatus().notNull().default("approved"),
  },
  (table) => [index("evidence_metrics_family_status_idx").on(table.family, table.status)],
);

export const evidenceFacts = mysqlTable(
  "evidence_facts",
  {
    id: varchar({ length: 255 }).primaryKey(),
    sourceId: varchar({ length: 128 })
      .notNull()
      .references(() => evidenceSources.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    metricId: varchar({ length: 160 })
      .notNull()
      .references(() => evidenceMetrics.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    label: varchar({ length: 255 }).notNull(),
    value: decimal({ precision: 18, scale: 6, mode: "number" }).notNull(),
    unit: varchar({ length: 32 }).notNull(),
    numerator: int(),
    denominator: int(),
    respondentBase: int().notNull(),
    validBase: int(),
    selectionCount: int(),
    geographyId: varchar({ length: 64 }).notNull(),
    segmentHash: varchar({ length: 64 }).notNull(),
    segment: json().$type<Record<string, string>>().notNull(),
    period: varchar({ length: 32 }).notNull(),
    weighting: mysqlEnum(["unweighted"] as const).notNull(),
    sourceColumn: int(),
    status: evidenceStatus().notNull().default("approved"),
    publishedAt: timestamp({ mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("evidence_facts_revision_key_uq").on(
      table.sourceId,
      table.metricId,
      table.geographyId,
      table.segmentHash,
      table.period,
    ),
    index("evidence_facts_metric_status_geo_idx").on(
      table.metricId,
      table.status,
      table.geographyId,
    ),
  ],
);

export const evidenceCitations = mysqlTable(
  "evidence_citations",
  {
    id: varchar({ length: 255 }).primaryKey(),
    factId: varchar({ length: 255 })
      .notNull()
      .references(() => evidenceFacts.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    sourceId: varchar({ length: 128 })
      .notNull()
      .references(() => evidenceSources.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    workbookField: varchar({ length: 96 }),
    page: int(),
    caveat: text().notNull(),
  },
  (table) => [index("evidence_citations_fact_idx").on(table.factId)],
);

export const evidenceDisputes = mysqlTable(
  "evidence_disputes",
  {
    id: varchar({ length: 160 }).primaryKey(),
    sourceId: varchar({ length: 128 })
      .notNull()
      .references(() => evidenceSources.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    metricId: varchar({ length: 160 }),
    status: evidenceStatus().notNull().default("blocked"),
    workbookValue: decimal({ precision: 18, scale: 6, mode: "number" }),
    reportValue: decimal({ precision: 18, scale: 6, mode: "number" }),
    note: text().notNull(),
  },
  (table) => [index("evidence_disputes_metric_status_idx").on(table.metricId, table.status)],
);

export const evidenceExcerpts = mysqlTable(
  "evidence_excerpts",
  {
    id: varchar({ length: 160 }).primaryKey(),
    sourceId: varchar({ length: 128 })
      .notNull()
      .references(() => evidenceSources.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    metricId: varchar({ length: 160 }),
    page: int().notNull(),
    theme: varchar({ length: 160 }).notNull(),
    geographyId: varchar({ length: 64 }).notNull(),
    period: varchar({ length: 32 }).notNull(),
    evidenceType: varchar({ length: 48 }).notNull(),
    paraphrase: text().notNull(),
    caveat: text().notNull(),
    status: evidenceStatus().notNull(),
  },
  (table) => [index("evidence_excerpts_metric_status_idx").on(table.metricId, table.status)],
);

export const evidenceSchema = {
  evidenceSources,
  evidenceMetrics,
  evidenceFacts,
  evidenceCitations,
  evidenceDisputes,
  evidenceExcerpts,
};
