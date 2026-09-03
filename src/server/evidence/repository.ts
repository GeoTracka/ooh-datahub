import { evidenceDisposition } from "@/evidence/rblLoma2026/policy";
import { and, eq, inArray } from "drizzle-orm";

import { evidenceDatabase } from "@/server/db/client";
import {
  evidenceCitations,
  evidenceFacts,
  evidenceSources,
} from "@/server/db/schema";

export type EvidenceQuery = {
  metricIds: readonly string[];
  geographyIds: readonly string[];
  ageBands?: readonly string[];
  genders?: readonly string[];
};

type StoredEvidenceFact = {
  factId: string;
  metricId: string;
  label: string;
  value: number;
  unit: string;
  numerator: number | null;
  denominator: number | null;
  respondentBase: number;
  geography: string;
  segment: Record<string, string>;
  period: string;
  weighting: string;
  status: string;
  citation: {
    sourceId: string;
    sha256: string;
    workbookField: string | null;
    page: number | null;
  };
};

export type EvidenceAnswer = {
  factId: string;
  metricId: string;
  label: string;
  value: number;
  unit: "percent" | "mean_1_5" | "respondents";
  numerator: number | null;
  denominator: number | null;
  respondentBase: number;
  geography: string;
  segment: Record<string, string>;
  period: string;
  caveat: string;
  citation: {
    sourceId: string;
    sha256: string;
    workbookField: string | null;
    page: number | null;
  };
};

export type EvidenceRepositoryAdapter = {
  findFacts(query: EvidenceQuery): Promise<readonly StoredEvidenceFact[]>;
};

function answerUnit(unit: string): EvidenceAnswer["unit"] {
  if (unit === "percent") return "percent";
  if (unit === "mean_rating" || unit === "mean_1_5") return "mean_1_5";
  if (unit === "respondents" || unit === "selections") return "respondents";
  throw new Error(`UNKNOWN_EVIDENCE_UNIT:${unit}`);
}

function validateBoundedQuery(query: EvidenceQuery): void {
  if (query.metricIds.length === 0 || query.geographyIds.length === 0) {
    throw new Error("BOUNDED_EVIDENCE_QUERY_REQUIRED");
  }
  if (query.metricIds.length > 25 || query.geographyIds.length > 12) {
    throw new Error("EVIDENCE_QUERY_TOO_BROAD");
  }
  for (const geography of query.geographyIds) {
    for (const metricId of query.metricIds) {
      const disposition = evidenceDisposition(metricId, geography);
      if (disposition.status === "blocked") {
        const code = disposition.reason === "unknown_metric"
          ? "UNKNOWN_EVIDENCE_METRIC"
          : "EVIDENCE_BLOCKED";
        throw new Error(`${code}:${metricId}:${disposition.reason}`);
      }
    }
  }
}

export function createEvidenceRepository(adapter: EvidenceRepositoryAdapter) {
  return {
    async search(query: EvidenceQuery): Promise<EvidenceAnswer[]> {
      validateBoundedQuery(query);
      const facts = await adapter.findFacts(query);
      return facts.map((fact) => {
        if (fact.status !== "approved") {
          throw new Error(`EVIDENCE_BLOCKED:${fact.factId}`);
        }
        if (!query.metricIds.includes(fact.metricId)) {
          throw new Error(`UNREQUESTED_EVIDENCE_METRIC:${fact.metricId}`);
        }
        if (!query.geographyIds.includes(fact.geography)) {
          throw new Error(`UNREQUESTED_EVIDENCE_GEOGRAPHY:${fact.geography}`);
        }
        if (!Number.isInteger(fact.respondentBase) || fact.respondentBase < 30) {
          throw new Error(`EVIDENCE_BASE_TOO_SMALL:${fact.factId}`);
        }
        if (fact.weighting !== "unweighted") {
          throw new Error(`UNKNOWN_EVIDENCE_WEIGHTING:${fact.factId}`);
        }

        return {
          factId: fact.factId,
          metricId: fact.metricId,
          label: fact.label,
          value: fact.value,
          unit: answerUnit(fact.unit),
          numerator: fact.numerator,
          denominator: fact.denominator,
          respondentBase: fact.respondentBase,
          geography: fact.geography,
          segment: fact.segment,
          period: fact.period,
          caveat:
            "Unweighted survey evidence for the study sample; not population reach or site delivery.",
          citation: fact.citation,
        };
      });
    },
  };
}

export function createMariaDbEvidenceRepository() {
  const { db } = evidenceDatabase();
  return createEvidenceRepository({
    async findFacts(query) {
      const rows = await db
        .select({
          factId: evidenceFacts.id,
          metricId: evidenceFacts.metricId,
          label: evidenceFacts.label,
          value: evidenceFacts.value,
          unit: evidenceFacts.unit,
          numerator: evidenceFacts.numerator,
          denominator: evidenceFacts.denominator,
          respondentBase: evidenceFacts.respondentBase,
          geography: evidenceFacts.geographyId,
          segment: evidenceFacts.segment,
          period: evidenceFacts.period,
          weighting: evidenceFacts.weighting,
          status: evidenceFacts.status,
          sourceId: evidenceSources.id,
          sha256: evidenceSources.sha256,
          workbookField: evidenceCitations.workbookField,
          page: evidenceCitations.page,
        })
        .from(evidenceFacts)
        .innerJoin(
          evidenceCitations,
          eq(evidenceCitations.factId, evidenceFacts.id),
        )
        .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFacts.sourceId))
        .where(
          and(
            inArray(evidenceFacts.metricId, [...query.metricIds]),
            inArray(evidenceFacts.geographyId, [...query.geographyIds]),
          ),
        );

      return rows
        .filter((row) => {
          if (
            query.ageBands?.length &&
            (!row.segment.ageBand || !query.ageBands.includes(row.segment.ageBand))
          ) {
            return false;
          }
          if (
            query.genders?.length &&
            (!row.segment.gender || !query.genders.includes(row.segment.gender))
          ) {
            return false;
          }
          return true;
        })
        .map((row) => ({
          factId: row.factId,
          metricId: row.metricId,
          label: row.label,
          value: row.value,
          unit: row.unit,
          numerator: row.numerator,
          denominator: row.denominator,
          respondentBase: row.respondentBase,
          geography: row.geography,
          segment: row.segment,
          period: row.period,
          weighting: row.weighting,
          status: row.status,
          citation: {
            sourceId: row.sourceId,
            sha256: row.sha256,
            workbookField: row.workbookField,
            page: row.page,
          },
        }));
    },
  });
}

export async function getApprovedEvidenceAnswersByIds(
  factIds: readonly string[],
): Promise<EvidenceAnswer[]> {
  const uniqueIds = [...new Set(factIds)];
  if (uniqueIds.length === 0 || uniqueIds.length > 200) {
    throw new Error("BOUNDED_EVIDENCE_FACT_IDS_REQUIRED");
  }
  const { db } = evidenceDatabase();
  const rows = await db
    .select({
      factId: evidenceFacts.id,
      metricId: evidenceFacts.metricId,
      label: evidenceFacts.label,
      value: evidenceFacts.value,
      unit: evidenceFacts.unit,
      numerator: evidenceFacts.numerator,
      denominator: evidenceFacts.denominator,
      respondentBase: evidenceFacts.respondentBase,
      geography: evidenceFacts.geographyId,
      segment: evidenceFacts.segment,
      period: evidenceFacts.period,
      weighting: evidenceFacts.weighting,
      status: evidenceFacts.status,
      sourceId: evidenceSources.id,
      sha256: evidenceSources.sha256,
      workbookField: evidenceCitations.workbookField,
      page: evidenceCitations.page,
    })
    .from(evidenceFacts)
    .innerJoin(evidenceCitations, eq(evidenceCitations.factId, evidenceFacts.id))
    .innerJoin(evidenceSources, eq(evidenceSources.id, evidenceFacts.sourceId))
    .where(inArray(evidenceFacts.id, uniqueIds));
  return rows.map((row) => {
    if (row.status !== "approved") throw new Error(`EVIDENCE_BLOCKED:${row.factId}`);
    if (row.weighting !== "unweighted") {
      throw new Error(`UNKNOWN_EVIDENCE_WEIGHTING:${row.factId}`);
    }
    if (row.respondentBase < 30) throw new Error(`EVIDENCE_BASE_TOO_SMALL:${row.factId}`);
    return {
      factId: row.factId,
      metricId: row.metricId,
      label: row.label,
      value: row.value,
      unit: answerUnit(row.unit),
      numerator: row.numerator,
      denominator: row.denominator,
      respondentBase: row.respondentBase,
      geography: row.geography,
      segment: row.segment,
      period: row.period,
      caveat:
        "Unweighted survey evidence for the study sample; not population reach or site delivery.",
      citation: {
        sourceId: row.sourceId,
        sha256: row.sha256,
        workbookField: row.workbookField,
        page: row.page,
      },
    };
  });
}
