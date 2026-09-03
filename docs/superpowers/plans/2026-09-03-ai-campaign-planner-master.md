# AI Campaign Planner Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a protected, chat-first OOH campaign-planning workspace that uses governed RBL/LOMA evidence, deterministic planner outputs, a visible map, and reversible fine-tuning.

**Architecture:** Execute three independently testable plans in order: governed evidence, MariaDB/OpenAI runtime, then the Quiet Intelligence workspace. Keep the existing PostgreSQL/PostGIS ingestion and five-step planner intact; the new runtime uses `MARIADB_URL`, while planner calculations continue through `src/application/plannerService.ts`.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 6, Zod 4, MariaDB, Drizzle ORM, mysql2, OpenAI Responses API, MapLibre, Vitest, Testing Library, Playwright.

---

## Plan set and dependency order

1. `docs/superpowers/plans/2026-09-03-rbl-loma-evidence.md`
2. `docs/superpowers/plans/2026-09-03-ai-planner-runtime.md`
3. `docs/superpowers/plans/2026-09-03-ai-planner-workspace.md`

The evidence plan produces a safe MariaDB read model and fail-closed evidence API. The runtime plan consumes that API and produces authenticated streamed conversations plus versioned campaign artifacts. The workspace plan consumes the runtime event contract and produces the customer interface. Do not start a dependent plan before the preceding plan's final gate passes.

## Specification coverage map

| Approved requirement | Owning plan/task |
| --- | --- |
| Register and reconcile both study sources | Evidence Tasks 2–6 |
| Never expose respondent identity, GPS, device, or raw text | Evidence Tasks 3, 5, and 7 |
| Block disputed metrics and unsupported delivery claims | Evidence Tasks 4 and 7; Runtime Tasks 5 and 9 |
| Persisted authenticated chats | Runtime Tasks 2–4 and 8 |
| OpenAI streaming with strict tools | Runtime Tasks 5–8 |
| Three distinct optional approaches | Runtime Task 6; Workspace Task 5 |
| Real right-side map and useful fallback | Workspace Task 6 |
| Audience and evidence inspection with bases/citations | Workspace Task 7 |
| Reversible fine-tuning and deterministic handoff | Runtime Tasks 4 and 6; Workspace Task 8 |
| Clean premium responsive workspace | Workspace Tasks 2–4 |
| Accessibility and UI/UX quality review | Workspace Task 9 |
| MariaDB runtime without replatforming PostGIS | Evidence Task 1 and locked boundaries above |
| No radio, activation, booking, or invented inventory | Evidence Task 4; Runtime Tasks 5 and 9 |

## Locked boundaries

- `DATABASE_URL` remains the PostgreSQL/PostGIS operations URL used by existing scripts and migrations.
- `MARIADB_URL` is the only database URL used by the web runtime, chat, authentication, evidence read model, and artifacts.
- Raw respondent rows, interviewer names, device IDs, GPS, submission metadata, and raw open text never enter MariaDB runtime tables or OpenAI requests.
- The OpenAI Responses API interprets intent and explains outputs; all numerical plan results come from governed evidence tools or `plannerService`.
- The first release has no booking, supplier messaging, campaign launch, radio-plan, activation-plan, or live-inventory tool.
- Dynamic route parameters use the Next.js 16 promise form. Runtime pages that read cookies or dynamic parameters use the documented Suspense boundary pattern.
- The response route returns a Web `ReadableStream`; it does not buffer an OpenAI response before returning.
- Provider responses use `store: false`; MariaDB is the application conversation source of truth.

### Task 1: Establish the implementation branch and baseline

**Files:**
- Read: `AGENTS.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Read: `node_modules/next/dist/docs/01-app/02-guides/streaming.md`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
- Verify: `package.json`

- [ ] **Step 1: Create the isolated worktree**

Run the `using-git-worktrees` skill, create branch `codex/ai-campaign-planner`, and work only in that worktree.

- [ ] **Step 2: Verify the clean baseline**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0. Record any pre-existing failure before changing files.

- [ ] **Step 3: Record the baseline commit**

Run:

```powershell
git rev-parse HEAD
git status --short
```

Expected: the SHA is recorded in the task notes and no unexpected tracked change is present.

### Task 2: Execute the governed evidence plan

**Files:**
- Plan: `docs/superpowers/plans/2026-09-03-rbl-loma-evidence.md`

- [ ] **Step 1: Execute every evidence-plan checkbox in order**

Use the exact source files named in that plan. Do not copy them into Git.

- [ ] **Step 2: Run the evidence release gate**

Run:

```powershell
pnpm evidence:verify
pnpm test -- tests/unit/evidence
pnpm typecheck
```

Expected: checksum, privacy, reconciliation, aggregation, and fail-closed tests pass; unresolved recall discrepancies remain blocked.

- [ ] **Step 3: Commit the completed evidence slice**

```powershell
git add package.json pnpm-lock.yaml .env.example src/evidence src/server/db src/server/evidence scripts/evidence scripts/mariadb migrations-mariadb tests/unit/evidence docs/data
git commit -m "feat: govern RBL LOMA campaign evidence"
```

### Task 3: Execute the authenticated AI runtime plan

**Files:**
- Plan: `docs/superpowers/plans/2026-09-03-ai-planner-runtime.md`

- [ ] **Step 1: Execute every runtime-plan checkbox in order**

Keep each tool schema strict and validate model arguments again with Zod before execution.

- [ ] **Step 2: Run the runtime release gate**

Run:

```powershell
pnpm test -- tests/unit/auth tests/unit/ai tests/unit/artifacts tests/component/LoginPage.test.tsx
pnpm ai:eval
pnpm typecheck
pnpm build
```

Expected: unauthenticated access is rejected; tool calls are idempotent; citations survive artifact revisions; forbidden inventory/radio/activation claims score zero in the fixed evaluation set.

- [ ] **Step 3: Commit the completed runtime slice**

```powershell
git add package.json pnpm-lock.yaml .env.example src/app/api/auth src/app/api/chat src/app/login src/server/auth src/server/ai src/server/artifacts src/server/db scripts/auth scripts/evals migrations-mariadb tests
git commit -m "feat: add authenticated AI planning runtime"
```

### Task 4: Execute the Quiet Intelligence workspace plan

**Files:**
- Plan: `docs/superpowers/plans/2026-09-03-ai-planner-workspace.md`

- [ ] **Step 1: Execute every workspace-plan checkbox in order**

Reuse `MapCanvas`, `projectMapLibreScene`, `plannerService`, and the existing UI-review harness. Do not duplicate planner math or MapLibre setup.

- [ ] **Step 2: Run the workspace release gate**

Run:

```powershell
pnpm test -- tests/component/chat tests/unit/chat
pnpm test:e2e -- tests/e2e/chat-workspace.spec.ts tests/e2e/chat-responsive.spec.ts tests/e2e/chat-recovery.spec.ts
pnpm test:ui-review
pnpm verify
```

Expected: all commands exit 0 and UI review evidence exists for 375, 768, 1024, and 1440px.

- [ ] **Step 3: Commit the completed workspace slice**

```powershell
git add package.json pnpm-lock.yaml src/app src/features/chat src/hooks src/content tests playwright.ui-review.config.ts docs/ui-ux-review-ci.md
git commit -m "feat: add premium AI campaign workspace"
```

### Task 5: Perform the integrated release review

**Files:**
- Modify: `README.md`
- Modify: `docs/ui-ux-review-ci.md`
- Create: `docs/ai-campaign-planner-operations.md`
- Test: `tests/e2e/chat-workspace.spec.ts`

- [ ] **Step 1: Write the operations contract**

Document these exact production requirements:

```text
MARIADB_URL                 server-only MariaDB connection URL
OPENAI_API_KEY              server-only OpenAI project key
OPENAI_MODEL                approved Responses API model ID
SESSION_COOKIE_SECRET       32+ random bytes
APP_ORIGIN                  https://ooh.brainpad.me
RBL_LOMA_RAW_SOURCE_URI     rights-controlled source location
```

Include database backup, migration-before-deploy, admin bootstrap, rollback, log-redaction, retention, and provider-outage procedures.

- [ ] **Step 2: Add the final smoke path**

The Playwright test must assert this sequence:

```ts
await page.goto("/login");
await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
await page.getByLabel("Password").fill(process.env.E2E_USER_PASSWORD!);
await page.getByRole("button", { name: "Sign in" }).click();
await page.goto("/chat");
await page.getByLabel("Describe your campaign").fill(
  "Plan a four-week Lagos launch for a consumer drink with an ₦18m budget.",
);
await page.getByRole("button", { name: "Send" }).click();
await expect(page.getByRole("tab", { name: "Plan" })).toBeVisible();
await expect(page.getByText("Three approaches", { exact: false })).toBeVisible();
await page.getByRole("tab", { name: "Map" }).click();
await expect(page.getByRole("region", { name: "Campaign map" })).toBeVisible();
await expect(page.getByText("© OpenStreetMap contributors")).toBeVisible();
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
pnpm mariadb:check
pnpm evidence:verify
pnpm ai:eval
pnpm verify
pnpm test:ui-review
```

Expected: all commands exit 0.

- [ ] **Step 4: Review the UI evidence manually**

Inspect every image and JSON sidecar under `artifacts/ui-ux-review/chromium`. Classify findings as blocking, major, or polish. Resolve and recapture all blocking and major findings. Confirm:

- no unexplained blank right-side canvas;
- at least three meaningfully different plan approaches;
- no forced package selection;
- map selection, legend, resize, and fallback behavior;
- reversible fine-tuning and visible revision feedback;
- plain-language copy with no demo/synthetic terminology;
- visible focus, 44px controls, reduced motion, and no page overflow.

- [ ] **Step 5: Commit release documentation**

```powershell
git add README.md docs/ai-campaign-planner-operations.md docs/ui-ux-review-ci.md tests/e2e/chat-workspace.spec.ts
git commit -m "docs: add AI planner operations and release gate"
```

### Task 6: Deploy and verify `ooh.brainpad.me`

**Files:**
- Read: `docs/ai-campaign-planner-operations.md`

- [ ] **Step 1: Review the current server before mutation**

Use the established SSH key and port. Record active containers/processes, listeners, web-root or deployment directory, reverse-proxy configuration, current Git SHA, MariaDB service health, database backups, and TLS status. Do not stop a healthy service during discovery.

- [ ] **Step 2: Back up and migrate MariaDB**

Create a timestamped logical backup in the deployment's existing backup location, verify the file is non-empty, then run:

```sh
pnpm mariadb:migrate
pnpm evidence:publish
```

Expected: migrations apply once; evidence publication reports the two pinned hashes and zero privacy-policy violations.

- [ ] **Step 3: Deploy using the site's existing process manager**

Install with the locked pnpm version, build, atomically switch the release, and reload the existing process manager. Do not replace the reverse proxy or database service.

- [ ] **Step 4: Run production smoke checks**

Verify HTTPS, `/login`, authenticated `/chat`, one evidence question, one three-option plan, Map artifact rendering, fine-tuning, undo, and visual-planner handoff. Verify that an unauthenticated POST to `/api/chat/respond` returns 401 and that no secret is present in downloaded JavaScript.

- [ ] **Step 5: Keep deployment state out of Git**

Do not commit server secrets, dumps, raw study files, generated local evidence staging, release symlinks, or process-manager state. If deployment reveals an application defect, stop the rollout, reproduce it in the worktree with a failing test, fix it through the normal plan workflow, rerun the full gate, and create a scoped commit containing only that tested correction.
