# Governed Drive Data Seeding

The repository has two deliberately separate data paths:

1. `src/demo/lagos-v1/bundle.json` is the deterministic synthetic Evidence-D demo bundle used by the planner.
2. `pnpm seed:data` is the governed landing/normalization path for the real OOH industry and FAAN workbooks supplied in Drive.

Real source rows are **not** promoted into the frozen planner bundle merely because they have been ingested. The Drive files do not contain the complete coordinate, supplier, exposure-geometry, movement, target-universe, panel or calibration inputs required by the current planner contract.

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

## Running the seed

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

NDJSON is used for staging so large source families can be streamed into later warehouse/database loaders without turning the repository into a database implementation prematurely.

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

## Persistence and planner boundary

This tranche stops at deterministic, replayable staging because the current application intentionally has no production database/warehouse contract. The next production steps are:

1. choose the durable persistence boundary and add idempotent source-revision upserts;
2. normalize advertiser/brand/category/format/airport entities while retaining source literals;
3. add rights-approved spatial enrichment and stable site/supplier identity;
4. derive historical/context features with explicit source provenance; and
5. promote data into planner measurement inputs only after the existing evidence/calibration requirements are met.

Do not make the synthetic demo bundle read these staging files directly. That would mix source observations with calibrated planner inputs and would overstate what the Drive data can support.
