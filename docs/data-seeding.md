# Governed Drive Data Seeding

The repository has three deliberately separate data layers:

1. `src/demo/lagos-v1/bundle.json` — deterministic synthetic Evidence-D planner bundle.
2. `pnpm seed:data` — governed landing/normalization path for the reviewed OOH and FAAN workbooks.
3. `pnpm seed:persist` — durable PostgreSQL persistence for normalized seed staging.

Real source rows are **not** promoted into the frozen planner bundle merely because they have been ingested or persisted. The Drive files do not contain the complete coordinate, supplier, exposure-geometry, movement, target-universe, panel or calibration inputs required by the current planner contract.

## Source catalog

`src/seed/sourceCatalog.ts` is the review boundary. It pins the exact six reviewed files by Drive file ID, filename and SHA-256 digest, plus the source sheets/sections that are authoritative for ingestion.

| Source | Seed role |
| --- | --- |
| OOH historical YTD 2018–Oct 2023 | Historical placement observations; 2023 rows retained but marked superseded |
| OOH full-year 2023 | Authoritative 2023 placement observations from `DATA` |
| OOH 2023 `NB SOV` | Separate board-quality observations; year comes from artifact context |
| OOH FY2024–Q1 2025 | Placement observations; malformed/shifted rows are quarantined |
| FAAN 2023 | Passenger, aircraft, cargo and mail traffic |
| FAAN 2024 | Passenger, aircraft, cargo and mail traffic |
| FAAN 2025 | Passenger traffic only in the supplied workbook |

The full-year 2023 workbook contains duplicated/derived/working tabs. Only `DATA` is treated as the canonical placement table; `NB SOV` is ingested separately because its schema and meaning are different.

## Running the deterministic seed

Place the exact reviewed XLSX files in `data/raw/drive/` using the catalogued filenames, then run:

```bash
pnpm seed:data
```

Custom paths are supported:

```bash
pnpm seed:data -- --source-dir=/secure/ooh-drive --output-dir=/tmp/ooh-seed
```

The command verifies **all six source checksums before writing output**. A missing or changed workbook fails closed. OOH sheets additionally have reviewed physical row-count guards, so a workbook that keeps the same filename but changes its tab content is not accepted silently.

## Outputs

The generated directory is intentionally ignored by git and contains:

- `ooh-observations.ndjson` — normalized placement observations with exact source-row provenance and `active`/`superseded` status;
- `ooh-board-quality.ndjson` — 2023 `NB SOV` board-quality observations;
- `faan-monthly.ndjson` — directional monthly passenger/aircraft/cargo/mail records where supplied;
- `faan-annual.ndjson` — source annual summaries with independently derived directional totals;
- `quarantine.ndjson` — malformed rows that were not safe to normalize automatically; and
- `seed-report.json` — deterministic source coverage, counts and quality flags.

NDJSON is the immutable/replayable normalization staging boundary. Durable relational persistence is documented in `docs/data-persistence.md`.

## Source fidelity rules

### OOH period precision

A source month is retained exactly. Combined values such as `August/September` are represented as a combined period and are **not** split into two invented observations. A blank month remains quarter-only. Unknown labels are retained and flagged.

### 2023 source precedence

The historical workbook is YTD through October 2023 while the later workbook is full-year 2023. Historical 2023 rows are retained for reproducibility but marked `superseded`; they are not fuzzy-deduplicated against the final workbook. This avoids both double-counting and destructive guesses when the two revisions disagree.

### Malformed OOH rows

Rows whose year or required placement shape is shifted/invalid are written to quarantine with source file, sheet, source row and raw cells. The seeder does not reconstruct them heuristically.

### FAAN totals

Directional values are preserved independently from source-reported totals. The pipeline calculates `derivedTotal` from arrivals/departures or imports/exports when both sides exist and flags disagreements with the reported total. Loose source literals such as `487, 048` are parsed, while dash values remain missing (`null`) rather than becoming zero.

Some cargo/mail sheets do not contain a reported total column for every month; that schema absence is not mislabelled as missing source data.

### Coverage gaps

The supplied 2025 FAAN workbook contains passenger sections but no aircraft, cargo or mail sections. `seed-report.json` records those metrics as absent. Absence is never converted to zero.

## Durable persistence

T2 uses PostgreSQL as the normalized durable/query store while retaining the exact XLSX source artifacts outside the database in immutable storage.

Persistence is idempotent by source revision and source record:

```text
source_id + source_artifact_sha256 + source_record_id
```

A rerun of the same reviewed source revision cannot duplicate the fact. A changed workbook revision can coexist with the prior version without destructive rewrites.

Run:

```bash
DATABASE_URL='postgresql://...' \
OOH_RAW_SOURCE_URI='s3://company-ooh-raw/reviewed/' \
OOH_SEED_STAGING_URI='s3://company-ooh-staging/drive-r1/' \
pnpm seed:persist
```

The persistence loader records source revisions, raw/staging locations, ingestion-run status, seed-report/staging hashes, processed counts and failures. It streams PostgreSQL `COPY` data through temporary staging tables and commits the observation load atomically.

See `docs/data-persistence.md` for migration, replay, retention and operational details.

## Planner boundary and next work

Persisting the source data does **not** make it calibrated reach or delivery evidence.

The next production tranche is entity/spatial resolution:

1. normalize advertiser/brand/category/format/state/city and airport vocabularies while preserving source literals;
2. establish stable non-destructive site/entity identities;
3. map authoritative supplier/media-owner identities;
4. add rights-approved coordinates with source/license/accuracy; and
5. only then derive governed context features and later promote measurement inputs through the existing calibration requirements.

Do not make the synthetic demo bundle read these staging or PostgreSQL tables directly. That would mix historical/context observations with calibrated planner inputs and overstate what the Drive data can support.
