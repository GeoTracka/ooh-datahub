# Durable OOH / FAAN Data Persistence

This is the durable persistence boundary for the governed Drive seed pipeline documented in `docs/data-seeding.md`.

## Architecture decision

The production-normalized store is **PostgreSQL**. The source-of-record workbooks remain immutable outside PostgreSQL in rights-controlled object/file storage.

The boundary is intentionally:

```text
reviewed XLSX
  -> immutable raw storage
  -> deterministic `pnpm seed:data` staging
  -> immutable/replayable NDJSON staging
  -> PostgreSQL normalized observations + ingestion audit
  -> later entity resolution / context derivation
  -> only later, calibrated planner inputs
```

PostgreSQL is not used to manufacture missing evidence. Persisted Drive observations remain source observations/context until later tranches explicitly promote them through the existing evidence and calibration contracts.

## Why no ORM in this layer

This ingestion path is append-oriented, provenance-heavy and bulk-loaded. T2 uses versioned SQL plus PostgreSQL `COPY` through the standard `psql` client rather than adding an ORM/runtime dependency solely for seeding.

That gives:

- explicit schemas and constraints;
- native bulk ingestion for the large OOH source families;
- no client-bundle database dependency;
- low npm supply-chain overhead; and
- migrations that remain usable from application, warehouse or operations tooling later.

The application UI does not import this database layer. Persistence code lives under `scripts/`.

## Required runtime

- PostgreSQL supported by your deployment standard.
- `psql` available to the loader host/container.
- `DATABASE_URL` set to a server-only PostgreSQL URL.
- `OOH_RAW_SOURCE_URI` set to the immutable raw-source root used for the exact reviewed XLSX files.

`PSQL_BIN` can override the client binary name/path.

For production, also set `OOH_SEED_STAGING_URI` to the immutable location where the generated NDJSON seed staging is retained. If omitted, the loader records the local `file://` seed directory; that is useful for development but is not a production retention policy.

Retention URIs may use `file:`, `s3:`, `gs:`, `az:` or credential-free `https:`. Credentials embedded in URIs are rejected.

## Migrations

Run:

```bash
DATABASE_URL='postgresql://...' pnpm db:migrate
```

Migration files live under `migrations/` and are applied in numeric order.

The runner:

1. takes a PostgreSQL advisory lock;
2. bootstraps `ooh_data.schema_migrations`;
3. records the SHA-256 of every migration;
4. fails closed if an already-applied migration's checksum changes; and
5. serializes concurrent migration attempts.

`pnpm db:check` performs the repository-side migration manifest validation and is part of `pnpm verify`.

Applied migrations are immutable. Make a new migration instead of editing one already applied to a database.

## Persisting a seed run

After `pnpm seed:data`, run:

```bash
DATABASE_URL='postgresql://...' \
OOH_RAW_SOURCE_URI='s3://company-ooh-raw/reviewed/' \
OOH_SEED_STAGING_URI='s3://company-ooh-staging/drive-r1/' \
pnpm seed:persist
```

A custom local seed directory can be supplied:

```bash
pnpm seed:persist -- --seed-dir=/secure/generated/drive
```

The loader runs migrations first and then records:

- a unique ingestion run;
- catalog/seed/loader versions;
- the exact seed-report SHA-256;
- SHA-256 + size for each staged NDJSON artifact at persistence time;
- every source artifact revision by `source_id + SHA-256`;
- every known immutable raw-storage location;
- the source-run audit structures from `seed-report.json`;
- processed/quality/coverage counts; and
- terminal success/failure information.

## Idempotency and revision behavior

Observation identity is not a fuzzy business key.

For OOH/FAAN normalized records, the durable identity is:

```text
source_id + source_artifact_sha256 + source_record_id
```

For quarantine records, identity additionally hashes the source revision, sheet, row, reason and raw payload.

Consequences:

- rerunning the **same source revision** does not create duplicate facts;
- the first ingestion run that inserted a fact remains recorded;
- a **new workbook revision** can coexist with the prior revision;
- older facts are not destructively rewritten merely because a newer source exists; and
- the existing historical-2023 `superseded` semantics remain explicit data, not physical deletion.

The loader does not `TRUNCATE` these tables.

## Atomicity and audit failure handling

Run metadata is registered first with status `running`.

Normalized observation loading then happens in one PostgreSQL transaction using temporary staging tables + `COPY`. Inserts use immutable conflict keys and `DO NOTHING` for rerun idempotency.

Before success, the loader verifies the number of streamed rows matches the deterministic seed report for each output family.

On success the run becomes `succeeded`. If the load fails, the data transaction rolls back and the run is separately marked `failed` with a bounded error code/detail.

This makes a failed run visible without leaving a partially loaded observation set.

## Core tables

The first persistence migration creates:

- `source_artifact_revisions`
- `source_artifact_locations`
- `ingestion_runs`
- `ingestion_run_sources`
- `ooh_observations`
- `ooh_board_quality_observations`
- `faan_monthly_observations`
- `faan_annual_observations`
- `quarantine_records`

Every normalized table retains the complete normalized record in `record_json`, while frequently queried fields are also typed columns. Period objects, raw FAAN directional values and quality flags remain JSON rather than being flattened away.

## Security boundary

`DATABASE_URL` is server/operations-only and must never be exposed with `NEXT_PUBLIC_*`.

The loader converts the URL into libpq environment variables before launching `psql`, so the database password is not placed in the `psql` command-line arguments.

Raw/staging retention URIs should be non-secret identifiers. Use workload identity, instance roles or your deployment secret manager for storage credentials rather than embedding credentials in those URIs.

## Continuous verification

CI starts a real PostgreSQL service and runs `pnpm test:data-persistence`. The integration fixture proves:

- migration application and rerun idempotency;
- two successful replays of the same source revision produce one durable fact set;
- first-ingestion lineage is retained;
- a deliberately inconsistent staging/report count creates a failed audit run; and
- that failed run rolls back its observation transaction rather than leaving partial data.

## Next tranche

T3 remains separate:

- canonical advertiser/brand/category/format/state/city vocabularies;
- stable non-destructive site/entity identity;
- canonical airport identity;
- authoritative supplier/media-owner mapping; and
- rights-approved geocoding with coordinate source/license/accuracy.

None of those should rewrite the immutable source observation tables.
