# RBL/LOMA Evidence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the two pinned 2026 RBL/LOMA sources into a privacy-safe, reproducible, fail-closed MariaDB evidence read model for campaign planning.

**Architecture:** Keep raw sources outside Git and validate them by SHA-256. Normalize only permitted survey fields into local restricted staging, calculate unweighted aggregates deterministically, apply an explicit metric policy, and publish only approved facts, citations, disputes, and reviewed report paraphrases to MariaDB.

**Tech Stack:** TypeScript 6, Zod 4, ExcelJS, pdfjs-dist, Drizzle ORM, mysql2, MariaDB, Vitest.

---

## File map

- `src/evidence/contracts.ts`: shared source, fact, citation, status, filter, and query schemas.
- `src/evidence/sourceCatalog.ts`: the two immutable source identities and access classes.
- `src/evidence/rblLoma2026/columns.ts`: stable one-based workbook column map.
- `src/evidence/rblLoma2026/normalize.ts`: restricted row normalization and privacy allowlist.
- `src/evidence/rblLoma2026/aggregate.ts`: deterministic aggregate computation.
- `src/evidence/rblLoma2026/policy.ts`: approved and blocked metric/geography combinations.
- `src/evidence/rblLoma2026/reportEvidence.ts`: reviewed PDF page citations and paraphrases.
- `src/server/db/client.ts`: server-only MariaDB pool and Drizzle client.
- `src/server/db/schema/evidence.ts`: MariaDB evidence tables.
- `src/server/evidence/repository.ts`: fail-closed evidence queries.
- `scripts/evidence/audit-rbl-loma.ts`: checksum, schema, eligibility, discrepancy, and privacy audit.
- `scripts/evidence/build-rbl-loma.ts`: local restricted staging and approved publication payload.
- `scripts/evidence/publish-rbl-loma.ts`: idempotent MariaDB transaction.
- `scripts/evidence/verify-rbl-loma.ts`: release-gate verification.
- `migrations-mariadb/0001_evidence_foundation.sql`: evidence schema.
- `docs/data/rbl-loma-2026-data-dictionary.md`: safe field definitions.
- `docs/data/rbl-loma-2026-reconciliation.md`: discrepancies and disposition.
- `tests/unit/evidence/*.test.ts`: source, privacy, normalization, aggregation, policy, and repository tests.

### Task 1: Add the MariaDB and document-reading dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Write the environment test**

Create `tests/unit/evidence/runtimeConfig.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("evidenceRuntimeConfig", () => {
  it("requires MariaDB without reusing the PostgreSQL URL", () => {
    delete process.env.MARIADB_URL;
    process.env.DATABASE_URL = "postgresql://legacy";
    expect(() => evidenceRuntimeConfig()).toThrow("MARIADB_URL_REQUIRED");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test -- tests/unit/evidence/runtimeConfig.test.ts`

Expected: FAIL because `@/server/db/runtimeConfig` does not exist.

- [ ] **Step 3: Install dependencies and add scripts**

Run:

```powershell
pnpm add drizzle-orm mysql2 pdfjs-dist
pnpm add -D drizzle-kit
```

Add these scripts to `package.json`:

```json
{
  "mariadb:check": "drizzle-kit check --config=drizzle.config.ts",
  "mariadb:migrate": "tsx scripts/mariadb/migrate.ts",
  "evidence:audit": "tsx scripts/evidence/audit-rbl-loma.ts",
  "evidence:build": "tsx scripts/evidence/build-rbl-loma.ts",
  "evidence:publish": "tsx scripts/evidence/publish-rbl-loma.ts",
  "evidence:verify": "tsx scripts/evidence/verify-rbl-loma.ts"
}
```

Append to `.env.example`:

```dotenv
# Web-runtime MariaDB. Do not point this at the PostgreSQL/PostGIS pipeline.
MARIADB_URL=
RBL_LOMA_WORKBOOK_PATH=
RBL_LOMA_REPORT_PATH=
RBL_LOMA_EVIDENCE_STAGING_DIR=.local/evidence/rbl-loma-2026
```

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

if (!process.env.MARIADB_URL) throw new Error("MARIADB_URL_REQUIRED");

export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema/index.ts",
  out: "./migrations-mariadb",
  dbCredentials: { url: process.env.MARIADB_URL },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 4: Implement strict runtime config**

Create `src/server/db/runtimeConfig.ts`:

```ts
import "server-only";

export function evidenceRuntimeConfig() {
  const url = process.env.MARIADB_URL?.trim();
  if (!url) throw new Error("MARIADB_URL_REQUIRED");
  const parsed = new URL(url);
  if (parsed.protocol !== "mysql:") {
    throw new Error("MARIADB_URL_MUST_USE_MYSQL_PROTOCOL");
  }
  return { url } as const;
}
```

- [ ] **Step 5: Run the test and commit**

Run: `pnpm test -- tests/unit/evidence/runtimeConfig.test.ts`

Expected: PASS.

```powershell
git add package.json pnpm-lock.yaml .env.example drizzle.config.ts src/server/db/runtimeConfig.ts tests/unit/evidence/runtimeConfig.test.ts
git commit -m "build: add MariaDB evidence dependencies"
```

### Task 2: Pin the source catalog and workbook schema

**Files:**
- Create: `src/evidence/sourceCatalog.ts`
- Create: `src/evidence/rblLoma2026/columns.ts`
- Create: `tests/unit/evidence/sourceCatalog.test.ts`

- [ ] **Step 1: Write the failing source-identity test**

```ts
import { describe, expect, it } from "vitest";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import { RBL_COLUMNS } from "@/evidence/rblLoma2026/columns";

describe("RBL/LOMA 2026 catalog", () => {
  it("pins the reviewed files and privacy-safe columns", () => {
    expect(rblLoma2026Sources.map((source) => source.sha256)).toEqual([
      "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
      "a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff",
    ]);
    expect(RBL_COLUMNS.city).toBe(14);
    expect(RBL_COLUMNS.fourWeekRecall).toBe(205);
    expect(Object.values(RBL_COLUMNS)).not.toContain(7);
    expect(Object.values(RBL_COLUMNS)).not.toContain(8);
    expect(Object.values(RBL_COLUMNS)).not.toContain(9);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/sourceCatalog.test.ts`

Expected: FAIL because the catalog modules do not exist.

- [ ] **Step 3: Implement the catalog and one-based column map**

Use this source shape:

```ts
export const rblLoma2026Sources = [
  {
    id: "rbl-loma-ooh-penetration-databook-2026-r1",
    kind: "survey_workbook",
    fileName: "RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx",
    sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
    accessClass: "restricted_respondent_source",
    period: "2026-05",
  },
  {
    id: "rbl-loma-ooh-audience-penetration-study-2026-r1",
    kind: "published_report",
    fileName: "RBL-LOMA OOH AUDIENCE PENETRATION Study 2026.pdf",
    sha256: "a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff",
    accessClass: "reviewed_narrative_source",
    period: "2026",
  },
] as const;
```

Define `RBL_COLUMNS` with one-based positions for city 14, commute eligibility 115, age 118, gender 120, occupation 121, income 125, travel frequency 140, weekday time 143, primary transport 154, journey attention 156, weekly environments 158–164, route 165, area 166, category recall 167–189, noticed frequency 190, top formats 192–201, exposure environment 202, four-week recall 205, hardest-to-ignore 211, commute mood 214, commute attention 215–222, format ratings 226–258, creative triggers 262–268, and actions 270–276. Do not define respondent identity, interviewer, device, GPS, altitude, precision, or submission columns.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/unit/evidence/sourceCatalog.test.ts`

Expected: PASS.

```powershell
git add src/evidence tests/unit/evidence/sourceCatalog.test.ts
git commit -m "feat: pin RBL LOMA evidence sources"
```

### Task 3: Normalize only the permitted respondent fields

**Files:**
- Create: `src/evidence/contracts.ts`
- Create: `src/evidence/rblLoma2026/normalize.ts`
- Create: `tests/unit/evidence/normalize.test.ts`

- [ ] **Step 1: Write privacy and eligibility tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeSurveyRow } from "@/evidence/rblLoma2026/normalize";

describe("normalizeSurveyRow", () => {
  it("keeps permitted fields and drops identities and GPS", () => {
    const cells: unknown[] = [];
    cells[6] = "Interviewer name";
    cells[7] = "6.5 3.3";
    cells[13] = "Lagos";
    cells[114] = "Yes";
    cells[117] = "25-34";
    cells[119] = "Female";
    cells[155] = "A lot of attention";
    const result = normalizeSurveyRow(cells, 2);
    expect(result.kind).toBe("accepted");
    expect(JSON.stringify(result)).not.toContain("Interviewer name");
    expect(JSON.stringify(result)).not.toContain("6.5 3.3");
  });

  it("quarantines screening-close records", () => {
    const cells: unknown[] = [];
    cells[13] = "Lagos";
    cells[114] = "No";
    expect(normalizeSurveyRow(cells, 9)).toMatchObject({
      kind: "quarantined",
      reason: "not_resident_or_regular_commuter",
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/normalize.test.ts`

Expected: FAIL because the normalizer does not exist.

- [ ] **Step 3: Implement the discriminated result**

Use this public result boundary:

```ts
export type NormalizedSurveyRow = {
  rowNumber: number;
  city: string;
  ageBand: string | null;
  gender: string | null;
  occupation: string | null;
  incomeBand: string | null;
  mobility: Record<string, string | number | boolean | null>;
  formats: Record<string, string | number | boolean | null>;
  creative: Record<string, string | number | boolean | null>;
  actions: Record<string, string | number | boolean | null>;
};

export type NormalizeResult =
  | { kind: "accepted"; row: NormalizedSurveyRow }
  | { kind: "quarantined"; rowNumber: number; reason: "missing_city" | "unknown_city" | "not_resident_or_regular_commuter" };
```

Normalize whitespace and Unicode, map the 12 known cities to stable IDs, parse 1–5 ratings only inside range, and retain open route/area text only in restricted local staging. Never include those open fields in a publication payload.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/unit/evidence/normalize.test.ts`

Expected: PASS.

```powershell
git add src/evidence/contracts.ts src/evidence/rblLoma2026/normalize.ts tests/unit/evidence/normalize.test.ts
git commit -m "feat: normalize privacy-safe survey fields"
```

### Task 4: Build aggregates and fail-closed policy

**Files:**
- Create: `src/evidence/rblLoma2026/aggregate.ts`
- Create: `src/evidence/rblLoma2026/policy.ts`
- Create: `tests/unit/evidence/aggregate.test.ts`
- Create: `tests/unit/evidence/policy.test.ts`

- [ ] **Step 1: Write the aggregate contract test**

```ts
import { describe, expect, it } from "vitest";
import { percentageFact } from "@/evidence/rblLoma2026/aggregate";
import { evidenceDisposition } from "@/evidence/rblLoma2026/policy";

describe("RBL facts", () => {
  it("retains numerator, denominator, base, period and weighting caveat", () => {
    expect(percentageFact({ metricId: "journey_attention_high", city: "lagos", yes: 30, base: 50 })).toMatchObject({
      value: 60,
      numerator: 30,
      denominator: 50,
      respondentBase: 50,
      period: "2026-05",
      weighting: "unweighted",
    });
  });

  it("blocks four-week recall while workbook/report values conflict", () => {
    expect(evidenceDisposition("four_week_recall", "lagos")).toEqual({
      status: "blocked",
      reason: "workbook_report_mismatch",
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/aggregate.test.ts tests/unit/evidence/policy.test.ts`

Expected: FAIL because aggregate and policy modules do not exist.

- [ ] **Step 3: Implement initial approved metric families**

Calculate city and optional age/gender segments only when `respondentBase >= 30`. Publish:

```ts
export const APPROVED_METRIC_FAMILIES = [
  "sample_base",
  "journey_attention",
  "travel_frequency",
  "primary_transport",
  "weekday_time",
  "weekly_environment",
  "noticed_frequency",
  "top_format_seen",
  "hardest_to_ignore",
  "commute_mood",
  "commute_attention",
  "format_attention_rating",
  "format_recall_rating",
  "format_trust_rating",
  "format_effect_rating",
  "format_quality_rating",
  "creative_trigger",
  "reported_post_ad_action",
] as const;
```

Block `four_week_recall`, population extrapolation, site reach, frequency, price, availability, ROI, radio, and activation metrics. Ratings publish mean, valid base, and scale. Multi-select metrics publish selection count and valid respondent base, never percentages summed as exclusive categories.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/unit/evidence/aggregate.test.ts tests/unit/evidence/policy.test.ts`

Expected: PASS.

```powershell
git add src/evidence/rblLoma2026/aggregate.ts src/evidence/rblLoma2026/policy.ts tests/unit/evidence
git commit -m "feat: calculate governed campaign evidence"
```

### Task 5: Create the audit, reconciliation, and local staging commands

**Files:**
- Create: `scripts/evidence/io.ts`
- Create: `scripts/evidence/audit-rbl-loma.ts`
- Create: `scripts/evidence/build-rbl-loma.ts`
- Create: `scripts/evidence/verify-rbl-loma.ts`
- Create: `docs/data/rbl-loma-2026-data-dictionary.md`
- Create: `docs/data/rbl-loma-2026-reconciliation.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write command-level tests**

Create `tests/unit/evidence/audit.test.ts` that calls exported `auditSources()` with temporary fixtures and expects `SOURCE_CHECKSUM_MISMATCH`, `WORKBOOK_SCHEMA_MISMATCH`, and `PRIVACY_FIELD_IN_PUBLICATION` for the three invalid cases.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/audit.test.ts`

Expected: FAIL because audit functions do not exist.

- [ ] **Step 3: Implement deterministic audit outputs**

`auditSources()` must return:

```ts
type EvidenceAudit = {
  sourceHashes: Record<string, string>;
  workbook: { sheet: "Nigeria OOH 3"; rows: 1844; columns: 302; cities: Record<string, number> };
  eligibility: { accepted: number; quarantined: number; reasons: Record<string, number> };
  discrepancies: Array<{ id: string; status: "blocked" | "resolved"; workbookValue: number | null; reportValue: number | null; note: string }>;
  privacy: { restrictedFieldsObserved: string[]; restrictedFieldsPublished: [] };
};
```

The command must require the two environment paths, verify hashes before parsing, write only to `.local/evidence/rbl-loma-2026`, and atomically replace staging after success. Add `.local/` to `.gitignore`.

- [ ] **Step 4: Write the reconciliation document**

Record the 302-vs-337 variable discrepancy, Lagos 72.1%-vs-54.9% four-week-recall discrepancy, smaller Abuja/Kano denominator or transformation discrepancies, absent weighting formula, non-population-proportional quotas, nine age-56+ records, four screening-close records, and route/area normalization need. Mark four-week recall blocked and describe the source as a 12-city urban resident and commuter study.

- [ ] **Step 5: Run against the pinned local files**

Run:

```powershell
$env:RBL_LOMA_WORKBOOK_PATH='C:\Users\Son\Downloads\RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx'
$env:RBL_LOMA_REPORT_PATH='C:\Users\Son\Downloads\RBL-LOMA OOH AUDIENCE PENETRATION Study 2026.pdf'
pnpm evidence:audit
pnpm evidence:build
pnpm evidence:verify
```

Expected: the two hashes match, workbook shape is 1,844 × 302, restricted fields published is empty, and all unresolved discrepancies are blocked.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore scripts/evidence docs/data tests/unit/evidence/audit.test.ts
git commit -m "feat: audit and reconcile RBL LOMA study"
```

### Task 6: Add reviewed report evidence without raw retrieval

**Files:**
- Create: `src/evidence/rblLoma2026/reportEvidence.ts`
- Create: `tests/unit/evidence/reportEvidence.test.ts`

- [ ] **Step 1: Write the citation-safety test**

```ts
import { describe, expect, it } from "vitest";
import { reportEvidence } from "@/evidence/rblLoma2026/reportEvidence";

describe("reviewed report evidence", () => {
  it("contains bounded paraphrases with exact pages", () => {
    expect(reportEvidence.length).toBeGreaterThan(0);
    expect(reportEvidence.every((item) => item.page > 0 && item.paraphrase.length <= 500)).toBe(true);
    expect(reportEvidence.every((item) => item.status === "approved" || item.status === "blocked")).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/reportEvidence.test.ts`

Expected: FAIL because the reviewed evidence file does not exist.

- [ ] **Step 3: Extract and review the report candidates**

Use `pdfjs-dist` to extract page text locally. Implement the bounded extractor in `scripts/evidence/extract-report-candidates.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractReportCandidates(path: string) {
  const bytes = new Uint8Array(await readFile(path));
  const pdf = await getDocument({ data: bytes }).promise;
  const candidates: Array<{ page: number; text: string }> = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => "str" in item ? item.str : "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (/method|sample|creative|format|mobility|traffic|supply|spend|forecast|limitation/i.test(text)) {
      candidates.push({ page: pageNumber, text: text.slice(0, 4_000) });
    }
  }
  return candidates;
}

if (process.argv[1]?.endsWith("extract-report-candidates.ts")) {
  const path = process.env.RBL_LOMA_REPORT_PATH;
  if (!path) throw new Error("RBL_LOMA_REPORT_PATH_REQUIRED");
  const candidates = await extractReportCandidates(path);
  await writeFile(".local/evidence/rbl-loma-2026/report-candidates.json", JSON.stringify(candidates, null, 2));
}
```

Review that local candidate file against the PDF and store only concise paraphrases supporting methodology, qualitative city context, supply/spend/forecast context, creative guidance, and stated limitations. Each committed entry must include page, theme, geography, period, evidence type, caveat, and approval status. Do not commit extracted whole-page text. Any passage involved in a numerical discrepancy is `blocked`.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/unit/evidence/reportEvidence.test.ts`

Expected: PASS.

```powershell
git add src/evidence/rblLoma2026/reportEvidence.ts tests/unit/evidence/reportEvidence.test.ts
git commit -m "feat: add reviewed report citations"
```

### Task 7: Create and publish the MariaDB evidence read model

**Files:**
- Create: `src/server/db/client.ts`
- Create: `src/server/db/schema/evidence.ts`
- Create: `src/server/db/schema/index.ts`
- Create: `scripts/mariadb/migrate.ts`
- Create: `migrations-mariadb/0001_evidence_foundation.sql`
- Create: `scripts/evidence/publish-rbl-loma.ts`
- Create: `src/server/evidence/repository.ts`
- Create: `tests/unit/evidence/repository.test.ts`

- [ ] **Step 1: Write the fail-closed repository test**

```ts
import { describe, expect, it } from "vitest";
import { createEvidenceRepository } from "@/server/evidence/repository";

describe("evidence repository", () => {
  it("never returns blocked facts", async () => {
    const repo = createEvidenceRepository({
      findFacts: async () => [{ id: "x", metricId: "four_week_recall", status: "blocked" }],
    });
    await expect(repo.search({ metricIds: ["four_week_recall"], geographyIds: ["lagos"] }))
      .rejects.toThrow("EVIDENCE_BLOCKED");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/unit/evidence/repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement schema and migration**

Create MariaDB tables `evidence_sources`, `evidence_metrics`, `evidence_facts`, `evidence_citations`, `evidence_disputes`, and `evidence_excerpts`. Use `varchar(64)` SHA-256 fields, JSON filters, explicit `approved|blocked|superseded` status enums, foreign keys with restrictive deletion, unique fact keys over source revision + metric + geography + segment + period, and indexes on metric/status/geography.

- [ ] **Step 4: Implement idempotent publication**

The publisher must load the verified local publication payload, start one transaction, upsert source metadata, replace facts only for the same pinned source revision, insert citations/disputes/excerpts, verify counts and source hashes, then commit. It must reject any payload key matching `/gps|device|interviewer|submission|openText|routeRaw|areaRaw/i`.

- [ ] **Step 5: Implement repository output validation**

Return only this shape:

```ts
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
  citation: { sourceId: string; sha256: string; workbookField: string | null; page: number | null };
};
```

Reject blocked facts, bases below 30 for segmented queries, unknown metrics, unrestricted respondent queries, and unsupported population extrapolation.

- [ ] **Step 6: Run migration and tests**

Run:

```powershell
pnpm mariadb:check
pnpm mariadb:migrate
pnpm evidence:publish
pnpm test -- tests/unit/evidence
pnpm evidence:verify
```

Expected: all commands pass; a second publish changes no fact identity and produces no duplicates.

- [ ] **Step 7: Commit**

```powershell
git add src/server/db src/server/evidence scripts/mariadb scripts/evidence migrations-mariadb tests/unit/evidence
git commit -m "feat: publish governed evidence read model"
```
