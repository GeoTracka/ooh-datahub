import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2/promise";

import { APPROVED_METRIC_FAMILIES } from "@/evidence/rblLoma2026/policy";
import type { ReviewedReportEvidence } from "@/evidence/rblLoma2026/reportEvidence";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";
import { assertPublicationPrivacy } from "./audit-rbl-loma";
import { verifyPublication } from "./verify-rbl-loma";

type PublicationFact = {
  factId: string;
  metricId: string;
  label?: string;
  value: number;
  unit: string;
  numerator?: number;
  denominator?: number;
  respondentBase: number;
  validBase?: number;
  selectionCount?: number;
  segment: Record<string, string> & { city: string };
  period: string;
  weighting: "unweighted";
  sourceId: string;
  sourceColumn?: number;
};

type PublicationPayload = {
  sourceHashes: Record<string, string>;
  facts: PublicationFact[];
  reportEvidence: ReviewedReportEvidence[];
  blockedDiscrepancies: Array<{
    id: string;
    status: "blocked";
    workbookValue: number | null;
    reportValue: number | null;
    note: string;
  }>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableSegment(segment: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(segment).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function metricFamily(metricId: string): string {
  const family = [...APPROVED_METRIC_FAMILIES]
    .sort((left, right) => right.length - left.length)
    .find((candidate) =>
      metricId === candidate || metricId.startsWith(`${candidate}_`),
    );
  if (!family) throw new Error(`UNKNOWN_EVIDENCE_METRIC:${metricId}`);
  return family;
}

async function insertBatches(
  connection: PoolConnection,
  sql: string,
  rows: readonly (readonly unknown[])[],
  batchSize = 250,
): Promise<void> {
  for (let index = 0; index < rows.length; index += batchSize) {
    await connection.query(sql, [rows.slice(index, index + batchSize)]);
  }
}

export async function publishEvidencePayload(
  publication: PublicationPayload,
  url = evidenceRuntimeConfig().url,
): Promise<{ facts: number; excerpts: number; disputes: number }> {
  assertPublicationPrivacy(publication);
  verifyPublication(publication);

  const pool = createPool({ uri: url, connectionLimit: 2, decimalNumbers: true });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const source of rblLoma2026Sources) {
      await connection.execute(
        `INSERT INTO evidence_sources
          (id, kind, file_name, sha256, access_class, period, status)
         VALUES (?, ?, ?, ?, ?, ?, 'approved')
         ON DUPLICATE KEY UPDATE
          kind = VALUES(kind), file_name = VALUES(file_name),
          sha256 = VALUES(sha256), access_class = VALUES(access_class),
          period = VALUES(period), status = VALUES(status)`,
        [
          source.id,
          source.kind,
          source.fileName,
          publication.sourceHashes[source.id],
          source.accessClass,
          source.period,
        ],
      );
    }

    const metrics = new Map<
      string,
      { family: string; label: string; unit: string; status: "approved" | "blocked" }
    >();
    for (const fact of publication.facts) {
      metrics.set(fact.metricId, {
        family: metricFamily(fact.metricId),
        label: fact.label ?? fact.metricId,
        unit: fact.unit,
        status: "approved",
      });
    }
    metrics.set("four_week_recall", {
      family: "four_week_recall",
      label: "Four-week OOH recall",
      unit: "percent",
      status: "blocked",
    });
    for (const evidence of publication.reportEvidence) {
      if (!evidence.metricId || metrics.has(evidence.metricId)) continue;
      metrics.set(evidence.metricId, {
        family: evidence.metricId,
        label: evidence.theme,
        unit: "context",
        status: evidence.status,
      });
    }
    await insertBatches(
      connection,
      `INSERT INTO evidence_metrics (id, family, label, unit, status) VALUES ?
       ON DUPLICATE KEY UPDATE family = VALUES(family), label = VALUES(label),
       unit = VALUES(unit), status = VALUES(status)`,
      [...metrics].map(([id, metric]) => [
        id,
        metric.family,
        metric.label,
        metric.unit,
        metric.status,
      ]),
    );

    const workbookSourceId = rblLoma2026Sources[0].id;
    const reportSourceId = rblLoma2026Sources[1].id;
    await connection.execute(
      `DELETE c FROM evidence_citations c
       INNER JOIN evidence_facts f ON f.id = c.fact_id
       WHERE f.source_id = ?`,
      [workbookSourceId],
    );
    await connection.execute("DELETE FROM evidence_facts WHERE source_id = ?", [
      workbookSourceId,
    ]);
    await connection.execute("DELETE FROM evidence_disputes WHERE source_id = ?", [
      workbookSourceId,
    ]);
    await connection.execute("DELETE FROM evidence_excerpts WHERE source_id = ?", [
      reportSourceId,
    ]);

    const factRows = publication.facts.map((fact) => {
      const segment = stableSegment(fact.segment);
      return [
        fact.factId,
        fact.sourceId,
        fact.metricId,
        fact.label ?? fact.metricId,
        fact.value,
        fact.unit,
        fact.numerator ?? null,
        fact.denominator ?? null,
        fact.respondentBase,
        fact.validBase ?? null,
        fact.selectionCount ?? null,
        fact.segment.city,
        sha256(segment),
        segment,
        fact.period,
        fact.weighting,
        fact.sourceColumn ?? null,
        "approved",
      ];
    });
    await insertBatches(
      connection,
      `INSERT INTO evidence_facts
       (id, source_id, metric_id, label, value, unit, numerator, denominator,
        respondent_base, valid_base, selection_count, geography_id, segment_hash,
        segment, period, weighting, source_column, status) VALUES ?`,
      factRows,
    );

    const citationRows = publication.facts.map((fact) => [
      `citation:${sha256(fact.factId)}`,
      fact.factId,
      fact.sourceId,
      fact.sourceColumn ? `column:${fact.sourceColumn}` : null,
      null,
      "Unweighted survey evidence for the study sample; not population reach or site delivery.",
    ]);
    await insertBatches(
      connection,
      `INSERT INTO evidence_citations
       (id, fact_id, source_id, workbook_field, page, caveat) VALUES ?`,
      citationRows,
    );

    const disputeRows = publication.blockedDiscrepancies.map((dispute) => [
      dispute.id,
      workbookSourceId,
      dispute.id === "lagos_four_week_recall" ? "four_week_recall" : null,
      "blocked",
      dispute.workbookValue,
      dispute.reportValue,
      dispute.note,
    ]);
    await insertBatches(
      connection,
      `INSERT INTO evidence_disputes
       (id, source_id, metric_id, status, workbook_value, report_value, note) VALUES ?`,
      disputeRows,
    );

    const excerptRows = publication.reportEvidence.map((evidence) => [
      evidence.id,
      evidence.sourceId,
      evidence.metricId,
      evidence.page,
      evidence.theme,
      evidence.geography,
      evidence.period,
      evidence.evidenceType,
      evidence.paraphrase,
      evidence.caveat,
      evidence.status,
    ]);
    await insertBatches(
      connection,
      `INSERT INTO evidence_excerpts
       (id, source_id, metric_id, page, theme, geography_id, period,
        evidence_type, paraphrase, caveat, status) VALUES ?`,
      excerptRows,
    );

    const [countRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS fact_count FROM evidence_facts WHERE source_id = ?",
      [workbookSourceId],
    );
    if (Number(countRows[0]?.fact_count) !== publication.facts.length) {
      throw new Error(
        `PUBLISHED_FACT_COUNT_MISMATCH:${countRows[0]?.fact_count}:${publication.facts.length}`,
      );
    }

    await connection.commit();
    return {
      facts: publication.facts.length,
      excerpts: excerptRows.length,
      disputes: disputeRows.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const stagingDirectory = path.resolve(
    process.env.RBL_LOMA_EVIDENCE_STAGING_DIR?.trim() ||
      ".local/evidence/rbl-loma-2026",
  );
  const publication = JSON.parse(
    await readFile(path.join(stagingDirectory, "publication.json"), "utf8"),
  ) as PublicationPayload;
  const result = await publishEvidencePayload(publication);
  process.stdout.write(
    `Published ${result.facts} facts, ${result.excerpts} reviewed excerpts, and ${result.disputes} blocked disputes to MariaDB.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
