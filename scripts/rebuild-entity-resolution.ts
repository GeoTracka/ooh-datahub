import { randomUUID } from "node:crypto";
import { migrateDatabase } from "./db-migrate";
import { copyStart, copyTextRow, sqlLiteral } from "./data/persistenceFormat";
import { queryJsonRows } from "./data/queryJson";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";
import {
  ENTITY_RESOLVER_VERSION,
  airportAliasId,
  airportId,
  canonicalAliasId,
  canonicalEntityId,
  normalizeEntityLiteral,
  reviewItemId,
  sourceDisplayLiteral,
  stableResolutionId,
  strictSiteIdentity,
  type CanonicalEntityType,
} from "../src/dataResolution/normalize";

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

type VocabularyRow = {
  entityType: CanonicalEntityType;
  sourceLiteral: string;
  observationCount: number;
  firstYear: number | null;
  lastYear: number | null;
};

type VocabularyAlias = VocabularyRow & {
  displayLiteral: string;
  normalizedKey: string;
  entityId: string;
};

type VocabularyEntity = {
  entityId: string;
  entityType: CanonicalEntityType;
  normalizedKey: string;
  canonicalName: string;
  representativeObservationCount: number;
};

type SiteRow = {
  sourceId: string;
  sourceSha256: string;
  sourceRecordId: string;
  state: string;
  city: string;
  address: string | null;
  boardType: string;
  format: string;
};

type FaanAirportRow = {
  recordScope: "monthly" | "annual";
  sourceId: string;
  sourceSha256: string;
  sourceRecordId: string;
  stateLabel: string | null;
  airportName: string | null;
  airportLabel: string | null;
};

type ResolutionCounts = {
  canonicalEntities: number;
  canonicalAliases: number;
  siteEntities: number;
  siteAssertions: number;
  siteReviewItems: number;
  airportEntities: number;
  airportAliases: number;
  airportAssertions: number;
  airportReviewItems: number;
};

function zeroCounts(): ResolutionCounts {
  return {
    canonicalEntities: 0,
    canonicalAliases: 0,
    siteEntities: 0,
    siteAssertions: 0,
    siteReviewItems: 0,
    airportEntities: 0,
    airportAliases: 0,
    airportAssertions: 0,
    airportReviewItems: 0,
  };
}

async function writeCopyRows(
  session: PsqlSession,
  table: string,
  columns: readonly string[],
  rows: Iterable<readonly unknown[]> | AsyncIterable<readonly unknown[]>,
): Promise<number> {
  await session.write(copyStart(table, columns));
  let count = 0;
  try {
    for await (const row of rows) {
      await session.write(copyTextRow(row));
      count += 1;
    }
  } catch (error) {
    await session.write("\\.\n");
    throw error;
  }
  await session.write("\\.\n");
  return count;
}

function chooseRepresentative(current: VocabularyAlias, candidate: VocabularyAlias): VocabularyAlias {
  if (candidate.observationCount > current.observationCount) return candidate;
  if (candidate.observationCount < current.observationCount) return current;
  return candidate.displayLiteral < current.displayLiteral ? candidate : current;
}

async function buildVocabulary(
  databaseUrl: string,
  session: PsqlSession,
  runId: string,
  counts: ResolutionCounts,
): Promise<void> {
  const query = `
WITH source_literals(entity_type, source_literal, year) AS (
  SELECT 'advertiser', advertiser, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'brand', brand, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'category', category, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'format', format_category, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'state', state, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'city', city, year FROM ooh_data.ooh_observations
  UNION ALL SELECT 'brand', brand, year FROM ooh_data.ooh_board_quality_observations
  UNION ALL SELECT 'category', category, year FROM ooh_data.ooh_board_quality_observations
  UNION ALL SELECT 'format', format, year FROM ooh_data.ooh_board_quality_observations
  UNION ALL SELECT 'state', state, year FROM ooh_data.ooh_board_quality_observations
  UNION ALL SELECT 'city', city, year FROM ooh_data.ooh_board_quality_observations
)
SELECT json_build_object(
  'entityType', entity_type,
  'sourceLiteral', source_literal,
  'observationCount', count(*),
  'firstYear', min(year),
  'lastYear', max(year)
)::text
FROM source_literals
WHERE source_literal IS NOT NULL AND trim(source_literal) <> ''
GROUP BY entity_type, source_literal
ORDER BY entity_type, source_literal;
`;

  const aliases: VocabularyAlias[] = [];
  const representatives = new Map<string, VocabularyAlias>();
  for await (const row of queryJsonRows<VocabularyRow>(databaseUrl, query)) {
    const displayLiteral = sourceDisplayLiteral(row.sourceLiteral);
    const normalizedKey = normalizeEntityLiteral(row.sourceLiteral);
    if (!displayLiteral || !normalizedKey) continue;
    const alias: VocabularyAlias = {
      ...row,
      displayLiteral,
      normalizedKey,
      entityId: canonicalEntityId(row.entityType, normalizedKey),
    };
    aliases.push(alias);
    const key = `${row.entityType}\u0000${normalizedKey}`;
    const current = representatives.get(key);
    representatives.set(key, current ? chooseRepresentative(current, alias) : alias);
  }

  const entities: VocabularyEntity[] = [...representatives.values()]
    .map((alias) => ({
      entityId: alias.entityId,
      entityType: alias.entityType,
      normalizedKey: alias.normalizedKey,
      canonicalName: alias.displayLiteral,
      representativeObservationCount: alias.observationCount,
    }))
    .sort((left, right) => left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0);
  aliases.sort((left, right) => {
    const leftId = canonicalAliasId(left.entityType, left.displayLiteral);
    const rightId = canonicalAliasId(right.entityType, right.displayLiteral);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });

  await session.write(
    "CREATE TEMP TABLE resolve_entities (LIKE ooh_data.canonical_entities INCLUDING DEFAULTS) ON COMMIT DROP;\n",
  );
  counts.canonicalEntities = await writeCopyRows(
    session,
    "resolve_entities",
    [
      "entity_id", "entity_type", "normalized_key", "canonical_name", "resolver_version",
      "representative_observation_count", "first_resolution_run_id", "last_resolution_run_id",
    ],
    entities.map((entity) => [
      entity.entityId,
      entity.entityType,
      entity.normalizedKey,
      entity.canonicalName,
      ENTITY_RESOLVER_VERSION,
      entity.representativeObservationCount,
      runId,
      runId,
    ]),
  );
  await session.write(`
INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
)
SELECT
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
FROM resolve_entities
ON CONFLICT (entity_id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  representative_observation_count = EXCLUDED.representative_observation_count,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;
DROP TABLE resolve_entities;
`);

  await session.write(
    "CREATE TEMP TABLE resolve_aliases (LIKE ooh_data.canonical_entity_aliases INCLUDING DEFAULTS) ON COMMIT DROP;\n",
  );
  counts.canonicalAliases = await writeCopyRows(
    session,
    "resolve_aliases",
    [
      "alias_id", "entity_type", "source_literal", "normalized_key", "canonical_entity_id",
      "mapping_method", "resolver_version", "observation_count", "first_observed_year",
      "last_observed_year", "first_resolution_run_id", "last_resolution_run_id",
    ],
    aliases.map((alias) => [
      canonicalAliasId(alias.entityType, alias.displayLiteral),
      alias.entityType,
      alias.displayLiteral,
      alias.normalizedKey,
      alias.entityId,
      "exact_normalized",
      ENTITY_RESOLVER_VERSION,
      alias.observationCount,
      alias.firstYear,
      alias.lastYear,
      runId,
      runId,
    ]),
  );
  await session.write(`
INSERT INTO ooh_data.canonical_entity_aliases (
  alias_id, entity_type, source_literal, normalized_key, canonical_entity_id,
  mapping_method, resolver_version, observation_count, first_observed_year,
  last_observed_year, first_resolution_run_id, last_resolution_run_id
)
SELECT
  alias_id, entity_type, source_literal, normalized_key, canonical_entity_id,
  mapping_method, resolver_version, observation_count, first_observed_year,
  last_observed_year, first_resolution_run_id, last_resolution_run_id
FROM resolve_aliases
ON CONFLICT (alias_id) DO UPDATE SET
  observation_count = EXCLUDED.observation_count,
  first_observed_year = EXCLUDED.first_observed_year,
  last_observed_year = EXCLUDED.last_observed_year,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;
DROP TABLE resolve_aliases;
`);
}

async function buildSites(
  databaseUrl: string,
  session: PsqlSession,
  runId: string,
  counts: ResolutionCounts,
): Promise<void> {
  await session.write(
    "CREATE TEMP TABLE resolve_sites (LIKE ooh_data.site_entities INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
    "CREATE TEMP TABLE resolve_site_assertions (LIKE ooh_data.site_observation_assertions INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
    "CREATE TEMP TABLE resolve_reviews (LIKE ooh_data.resolution_review_items INCLUDING DEFAULTS) ON COMMIT DROP;\n",
  );

  const query = `
SELECT json_build_object(
  'sourceId', source_id,
  'sourceSha256', source_sha256,
  'sourceRecordId', source_record_id,
  'state', state,
  'city', city,
  'address', address,
  'boardType', board_type,
  'format', format_category
)::text
FROM ooh_data.ooh_observations
ORDER BY source_id, source_sha256, source_record_id;
`;

  const siteRows: unknown[][] = [];
  const assertionRows: unknown[][] = [];
  const reviewRows: unknown[][] = [];
  const flushLimit = 5000;

  async function flush(): Promise<void> {
    if (siteRows.length > 0) {
      counts.siteEntities += await writeCopyRows(
        session,
        "resolve_sites",
        [
          "site_id", "strict_key", "resolver_version", "identity_status",
          "state_entity_id", "city_entity_id", "format_entity_id",
          "representative_address", "normalized_address", "representative_board_type",
          "normalized_board_type", "first_resolution_run_id", "last_resolution_run_id",
        ],
        siteRows.splice(0),
      );
    }
    if (assertionRows.length > 0) {
      counts.siteAssertions += await writeCopyRows(
        session,
        "resolve_site_assertions",
        [
          "resolver_version", "source_id", "source_sha256", "source_record_id", "site_id",
          "assertion_method", "assertion_status", "first_resolution_run_id", "last_resolution_run_id",
        ],
        assertionRows.splice(0),
      );
    }
    if (reviewRows.length > 0) {
      counts.siteReviewItems += await writeCopyRows(
        session,
        "resolve_reviews",
        [
          "review_id", "domain", "resolver_version", "source_id", "source_sha256",
          "record_scope", "source_record_id", "source_literal", "normalized_key", "reason",
          "details", "first_resolution_run_id", "last_resolution_run_id",
        ],
        reviewRows.splice(0),
      );
    }
  }

  for await (const row of queryJsonRows<SiteRow>(databaseUrl, query)) {
    const identity = strictSiteIdentity({
      state: row.state,
      city: row.city,
      address: row.address,
      boardType: row.boardType,
      format: row.format,
    });
    if (!identity) {
      const addressDisplay = sourceDisplayLiteral(row.address);
      reviewRows.push([
        reviewItemId(
          "site_identity",
          "strict_site_key_incomplete",
          [row.sourceId, row.sourceSha256, row.sourceRecordId],
        ),
        "site_identity",
        ENTITY_RESOLVER_VERSION,
        row.sourceId,
        row.sourceSha256,
        "ooh_observation",
        row.sourceRecordId,
        addressDisplay,
        normalizeEntityLiteral(row.address),
        "strict_site_key_incomplete",
        {
          state: row.state,
          city: row.city,
          address: row.address,
          boardType: row.boardType,
          format: row.format,
        },
        runId,
        runId,
      ]);
    } else {
      const addressDisplay = sourceDisplayLiteral(row.address);
      const boardDisplay = sourceDisplayLiteral(row.boardType);
      if (!addressDisplay || !boardDisplay) throw new Error("STRICT_SITE_DISPLAY_INVARIANT");
      siteRows.push([
        identity.siteId,
        identity.strictKey,
        ENTITY_RESOLVER_VERSION,
        "candidate",
        canonicalEntityId("state", identity.stateKey),
        canonicalEntityId("city", identity.cityKey),
        canonicalEntityId("format", identity.formatKey),
        addressDisplay,
        identity.addressKey,
        boardDisplay,
        identity.boardTypeKey,
        runId,
        runId,
      ]);
      assertionRows.push([
        ENTITY_RESOLVER_VERSION,
        row.sourceId,
        row.sourceSha256,
        row.sourceRecordId,
        identity.siteId,
        "strict_normalized_location_format",
        "candidate",
        runId,
        runId,
      ]);
    }
    if (siteRows.length + assertionRows.length + reviewRows.length >= flushLimit) await flush();
  }
  await flush();

  await session.write(`
INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
)
SELECT DISTINCT ON (site_id)
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
FROM resolve_sites
ORDER BY site_id, representative_address, representative_board_type
ON CONFLICT (site_id) DO UPDATE SET
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;

INSERT INTO ooh_data.site_observation_assertions (
  resolver_version, source_id, source_sha256, source_record_id, site_id,
  assertion_method, assertion_status, first_resolution_run_id, last_resolution_run_id
)
SELECT
  resolver_version, source_id, source_sha256, source_record_id, site_id,
  assertion_method, assertion_status, first_resolution_run_id, last_resolution_run_id
FROM resolve_site_assertions
ON CONFLICT (resolver_version, source_id, source_sha256, source_record_id) DO UPDATE SET
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;

INSERT INTO ooh_data.resolution_review_items (
  review_id, domain, resolver_version, source_id, source_sha256, record_scope,
  source_record_id, source_literal, normalized_key, reason, details,
  first_resolution_run_id, last_resolution_run_id
)
SELECT
  review_id, domain, resolver_version, source_id, source_sha256, record_scope,
  source_record_id, source_literal, normalized_key, reason, details,
  first_resolution_run_id, last_resolution_run_id
FROM resolve_reviews
ON CONFLICT (review_id) DO UPDATE SET
  details = EXCLUDED.details,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id,
  updated_at = now();

DROP TABLE resolve_sites;
DROP TABLE resolve_site_assertions;
DROP TABLE resolve_reviews;
`);
}

type AirportGroup = {
  airportId: string;
  normalizedNameKey: string;
  canonicalName: string;
  representativeCount: number;
  stateKeys: Set<string>;
};

type AirportAliasAggregate = {
  aliasId: string;
  airportId: string;
  sourceLiteral: string;
  normalizedKey: string;
  aliasKind: "airport_name" | "state_anchor" | "airport_label";
  mappingMethod: "exact_normalized" | "unique_state_anchor";
  observationCount: number;
};

function addAirportAlias(
  aliases: Map<string, AirportAliasAggregate>,
  alias: Omit<AirportAliasAggregate, "aliasId" | "observationCount">,
): void {
  const aliasId = airportAliasId(alias.aliasKind, alias.sourceLiteral);
  const current = aliases.get(aliasId);
  if (current && current.airportId !== alias.airportId) {
    throw new Error(`AIRPORT_ALIAS_COLLISION:${alias.aliasKind}:${alias.sourceLiteral}`);
  }
  aliases.set(aliasId, {
    ...alias,
    aliasId,
    observationCount: (current?.observationCount ?? 0) + 1,
  });
}

async function buildAirports(
  databaseUrl: string,
  session: PsqlSession,
  runId: string,
  counts: ResolutionCounts,
): Promise<void> {
  const query = `
SELECT json_build_object(
  'recordScope', record_scope,
  'sourceId', source_id,
  'sourceSha256', source_sha256,
  'sourceRecordId', source_record_id,
  'stateLabel', airport_state_label,
  'airportName', airport_name,
  'airportLabel', airport_label
)::text
FROM (
  SELECT 'monthly'::text AS record_scope, source_id, source_sha256, source_record_id,
         airport_state_label, airport_name, airport_label
  FROM ooh_data.faan_monthly_observations
  UNION ALL
  SELECT 'annual'::text AS record_scope, source_id, source_sha256, source_record_id,
         airport_state_label, airport_name, airport_label
  FROM ooh_data.faan_annual_observations
) records
ORDER BY record_scope, source_id, source_sha256, source_record_id;
`;

  const rows: FaanAirportRow[] = [];
  const airportGroups = new Map<string, AirportGroup>();
  const nameCounts = new Map<string, Map<string, number>>();
  const stateToAirportIds = new Map<string, Set<string>>();

  for await (const row of queryJsonRows<FaanAirportRow>(databaseUrl, query)) {
    rows.push(row);
    const nameDisplay = sourceDisplayLiteral(row.airportName);
    const nameKey = normalizeEntityLiteral(row.airportName);
    if (!nameDisplay || !nameKey) continue;
    const id = airportId(nameKey);
    const stateKey = normalizeEntityLiteral(row.stateLabel);
    let group = airportGroups.get(nameKey);
    if (!group) {
      group = {
        airportId: id,
        normalizedNameKey: nameKey,
        canonicalName: nameDisplay,
        representativeCount: 0,
        stateKeys: new Set<string>(),
      };
      airportGroups.set(nameKey, group);
    }
    const literalCounts = nameCounts.get(nameKey) ?? new Map<string, number>();
    const nextCount = (literalCounts.get(nameDisplay) ?? 0) + 1;
    literalCounts.set(nameDisplay, nextCount);
    nameCounts.set(nameKey, literalCounts);
    if (
      nextCount > group.representativeCount
      || (nextCount === group.representativeCount && nameDisplay < group.canonicalName)
    ) {
      group.canonicalName = nameDisplay;
      group.representativeCount = nextCount;
    }
    if (stateKey) {
      group.stateKeys.add(stateKey);
      const ids = stateToAirportIds.get(stateKey) ?? new Set<string>();
      ids.add(id);
      stateToAirportIds.set(stateKey, ids);
    }
  }

  const nameKeyToAirportId = new Map(
    [...airportGroups.values()].map((group) => [group.normalizedNameKey, group.airportId]),
  );
  const uniqueStateAnchor = new Map<string, string>();
  for (const [stateKey, ids] of stateToAirportIds) {
    if (ids.size === 1) uniqueStateAnchor.set(stateKey, [...ids][0]);
  }

  await session.write(
    "CREATE TEMP TABLE resolve_airports (LIKE ooh_data.airport_entities INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
    "CREATE TEMP TABLE resolve_airport_aliases (LIKE ooh_data.airport_aliases INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
    "CREATE TEMP TABLE resolve_airport_assertions (LIKE ooh_data.faan_airport_assertions INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
    "CREATE TEMP TABLE resolve_airport_reviews (LIKE ooh_data.resolution_review_items INCLUDING DEFAULTS) ON COMMIT DROP;\n",
  );

  counts.airportEntities = await writeCopyRows(
    session,
    "resolve_airports",
    [
      "airport_id", "normalized_name_key", "canonical_name", "state_normalized_key",
      "resolver_version", "identity_status", "first_resolution_run_id", "last_resolution_run_id",
    ],
    [...airportGroups.values()]
      .sort((left, right) => left.airportId < right.airportId ? -1 : left.airportId > right.airportId ? 1 : 0)
      .map((group) => [
        group.airportId,
        group.normalizedNameKey,
        group.canonicalName,
        group.stateKeys.size === 1 ? [...group.stateKeys][0] : null,
        ENTITY_RESOLVER_VERSION,
        "candidate",
        runId,
        runId,
      ]),
  );

  const aliases = new Map<string, AirportAliasAggregate>();
  const assertionRows: unknown[][] = [];
  const reviewRows: unknown[][] = [];

  for (const row of rows) {
    const nameDisplay = sourceDisplayLiteral(row.airportName);
    const nameKey = normalizeEntityLiteral(row.airportName);
    const labelDisplay = sourceDisplayLiteral(row.airportLabel);
    const labelKey = normalizeEntityLiteral(row.airportLabel);
    let resolvedAirportId: string | null = null;
    let method: "exact_airport_name" | "exact_airport_label" | "unique_state_anchor" | null = null;

    if (nameDisplay && nameKey) {
      resolvedAirportId = nameKeyToAirportId.get(nameKey) ?? null;
      method = resolvedAirportId ? "exact_airport_name" : null;
      if (resolvedAirportId) {
        addAirportAlias(aliases, {
          airportId: resolvedAirportId,
          sourceLiteral: nameDisplay,
          normalizedKey: nameKey,
          aliasKind: "airport_name",
          mappingMethod: "exact_normalized",
        });
      }
    } else if (labelDisplay && labelKey) {
      const exact = nameKeyToAirportId.get(labelKey);
      if (exact) {
        resolvedAirportId = exact;
        method = "exact_airport_label";
        addAirportAlias(aliases, {
          airportId: exact,
          sourceLiteral: labelDisplay,
          normalizedKey: labelKey,
          aliasKind: "airport_label",
          mappingMethod: "exact_normalized",
        });
      } else {
        const stateAnchored = uniqueStateAnchor.get(labelKey);
        if (stateAnchored) {
          resolvedAirportId = stateAnchored;
          method = "unique_state_anchor";
          addAirportAlias(aliases, {
            airportId: stateAnchored,
            sourceLiteral: labelDisplay,
            normalizedKey: labelKey,
            aliasKind: "state_anchor",
            mappingMethod: "unique_state_anchor",
          });
        }
      }
    }

    if (resolvedAirportId && method) {
      assertionRows.push([
        ENTITY_RESOLVER_VERSION,
        row.recordScope,
        row.sourceId,
        row.sourceSha256,
        row.sourceRecordId,
        resolvedAirportId,
        method,
        runId,
        runId,
      ]);
    } else {
      const sourceLiteral = nameDisplay ?? labelDisplay;
      const normalizedKey = nameKey ?? labelKey;
      reviewRows.push([
        reviewItemId(
          "airport_identity",
          "airport_label_unresolved",
          [row.recordScope, row.sourceId, row.sourceSha256, row.sourceRecordId],
        ),
        "airport_identity",
        ENTITY_RESOLVER_VERSION,
        row.sourceId,
        row.sourceSha256,
        row.recordScope,
        row.sourceRecordId,
        sourceLiteral,
        normalizedKey,
        "airport_label_unresolved",
        {
          stateLabel: row.stateLabel,
          airportName: row.airportName,
          airportLabel: row.airportLabel,
        },
        runId,
        runId,
      ]);
    }
  }

  for (const [stateKey, ids] of stateToAirportIds) {
    if (ids.size <= 1) continue;
    const airportNames = [...ids]
      .map((id) => [...airportGroups.values()].find((group) => group.airportId === id)?.canonicalName ?? id)
      .sort();
    reviewRows.push([
      reviewItemId("airport_identity", "state_anchor_ambiguous", [stateKey]),
      "airport_identity",
      ENTITY_RESOLVER_VERSION,
      null,
      null,
      "state_anchor",
      null,
      stateKey,
      stateKey,
      "state_anchor_ambiguous",
      { airportIds: [...ids].sort(), airportNames },
      runId,
      runId,
    ]);
  }

  counts.airportAliases = await writeCopyRows(
    session,
    "resolve_airport_aliases",
    [
      "alias_id", "airport_id", "source_literal", "normalized_key", "alias_kind",
      "mapping_method", "resolver_version", "observation_count",
      "first_resolution_run_id", "last_resolution_run_id",
    ],
    [...aliases.values()]
      .sort((left, right) => left.aliasId < right.aliasId ? -1 : left.aliasId > right.aliasId ? 1 : 0)
      .map((alias) => [
        alias.aliasId,
        alias.airportId,
        alias.sourceLiteral,
        alias.normalizedKey,
        alias.aliasKind,
        alias.mappingMethod,
        ENTITY_RESOLVER_VERSION,
        alias.observationCount,
        runId,
        runId,
      ]),
  );
  counts.airportAssertions = await writeCopyRows(
    session,
    "resolve_airport_assertions",
    [
      "resolver_version", "record_scope", "source_id", "source_sha256", "source_record_id",
      "airport_id", "assertion_method", "first_resolution_run_id", "last_resolution_run_id",
    ],
    assertionRows,
  );
  counts.airportReviewItems = await writeCopyRows(
    session,
    "resolve_airport_reviews",
    [
      "review_id", "domain", "resolver_version", "source_id", "source_sha256",
      "record_scope", "source_record_id", "source_literal", "normalized_key", "reason",
      "details", "first_resolution_run_id", "last_resolution_run_id",
    ],
    reviewRows,
  );

  await session.write(`
INSERT INTO ooh_data.airport_entities (
  airport_id, normalized_name_key, canonical_name, state_normalized_key,
  resolver_version, identity_status, first_resolution_run_id, last_resolution_run_id
)
SELECT
  airport_id, normalized_name_key, canonical_name, state_normalized_key,
  resolver_version, identity_status, first_resolution_run_id, last_resolution_run_id
FROM resolve_airports
ON CONFLICT (airport_id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  state_normalized_key = EXCLUDED.state_normalized_key,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;

INSERT INTO ooh_data.airport_aliases (
  alias_id, airport_id, source_literal, normalized_key, alias_kind,
  mapping_method, resolver_version, observation_count,
  first_resolution_run_id, last_resolution_run_id
)
SELECT
  alias_id, airport_id, source_literal, normalized_key, alias_kind,
  mapping_method, resolver_version, observation_count,
  first_resolution_run_id, last_resolution_run_id
FROM resolve_airport_aliases
ON CONFLICT (alias_id) DO UPDATE SET
  observation_count = EXCLUDED.observation_count,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;

INSERT INTO ooh_data.faan_airport_assertions (
  resolver_version, record_scope, source_id, source_sha256, source_record_id,
  airport_id, assertion_method, first_resolution_run_id, last_resolution_run_id
)
SELECT
  resolver_version, record_scope, source_id, source_sha256, source_record_id,
  airport_id, assertion_method, first_resolution_run_id, last_resolution_run_id
FROM resolve_airport_assertions
ON CONFLICT (resolver_version, record_scope, source_id, source_sha256, source_record_id) DO UPDATE SET
  last_resolution_run_id = EXCLUDED.last_resolution_run_id;

INSERT INTO ooh_data.resolution_review_items (
  review_id, domain, resolver_version, source_id, source_sha256, record_scope,
  source_record_id, source_literal, normalized_key, reason, details,
  first_resolution_run_id, last_resolution_run_id
)
SELECT
  review_id, domain, resolver_version, source_id, source_sha256, record_scope,
  source_record_id, source_literal, normalized_key, reason, details,
  first_resolution_run_id, last_resolution_run_id
FROM resolve_airport_reviews
ON CONFLICT (review_id) DO UPDATE SET
  details = EXCLUDED.details,
  last_resolution_run_id = EXCLUDED.last_resolution_run_id,
  updated_at = now();

DROP TABLE resolve_airports;
DROP TABLE resolve_airport_aliases;
DROP TABLE resolve_airport_assertions;
DROP TABLE resolve_airport_reviews;
`);
}

async function markResolutionFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const errorCode = detail.split(":")[0] || "RESOLUTION_FAILED";
  await runPsql(databaseUrl, `
UPDATE ooh_data.resolution_runs
SET status = 'failed', completed_at = now(),
    error_code = ${sqlLiteral(errorCode)}, error_detail = ${sqlLiteral(detail)}
WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';
`);
}

export async function rebuildEntityResolution(): Promise<{ runId: string; counts: ResolutionCounts }> {
  const databaseUrl = requiredDatabaseUrl();
  await migrateDatabase();
  const runId = randomUUID();
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, status)
VALUES (${sqlLiteral(runId)}::uuid, ${sqlLiteral(ENTITY_RESOLVER_VERSION)}, 'running');
`);

  const session = startPsql(databaseUrl);
  const counts = zeroCounts();
  let transactionOpen = false;
  try {
    await session.write("\\set ON_ERROR_STOP on\nBEGIN;\n");
    transactionOpen = true;
    await buildVocabulary(databaseUrl, session, runId, counts);
    await buildSites(databaseUrl, session, runId, counts);
    await buildAirports(databaseUrl, session, runId, counts);
    await session.write(`
UPDATE ooh_data.resolution_runs
SET status = 'succeeded', completed_at = now(), counts = ${sqlLiteral(JSON.stringify(counts))}::jsonb
WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';
COMMIT;
`);
    transactionOpen = false;
    await session.finish();
    return { runId, counts };
  } catch (error) {
    if (transactionOpen) {
      try {
        await session.write("ROLLBACK;\n");
      } catch {
        // psql may already have terminated after a server-side failure.
      }
    }
    try {
      await session.finish();
    } catch {
      // Preserve the resolver error; the audit update below uses a fresh session.
    }
    try {
      await markResolutionFailed(databaseUrl, runId, error);
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : String(auditError);
      process.stderr.write(`data:resolve failure-audit warning: ${auditMessage}\n`);
    }
    throw error;
  }
}

if (process.argv[1]?.endsWith("rebuild-entity-resolution.ts")) {
  rebuildEntityResolution()
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`data:resolve failed: ${message}\n`);
      process.exitCode = 1;
    });
}
