# Inline Chat Campaign and Evidence Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure chat-triggered XLSX and CSV exports for owned campaign-plan and governed-evidence artifacts.

**Architecture:** The AI tool prepares a small version-bound download descriptor rather than file bytes. The orchestrator streams and persists that descriptor, while a protected Node.js route generates the selected format on demand from the owned artifact and approved evidence rows.

**Tech Stack:** Next.js 16.3 Route Handlers, TypeScript, Zod, React 19, ExcelJS, Papa Parse, Vitest, Testing Library, MariaDB.

---

### Task 1: Define the durable export contract

**Files:**
- Modify: `src/server/chat/contracts.ts`
- Modify: `src/server/ai/orchestrator.ts`
- Modify: `src/server/chat/runtimePersistence.ts`
- Modify: `src/server/chat/service.ts`
- Test: `tests/unit/ai/orchestrator.test.ts`
- Test: `tests/unit/ai/chatRepository.test.ts`

- [ ] Write failing tests proving `download.ready` follows a completed export tool, and `download_ref` survives persistence/history conversion.
- [ ] Run `pnpm test tests/unit/ai/orchestrator.test.ts tests/unit/ai/chatRepository.test.ts` and confirm failure because the schemas and persistence fields do not exist.
- [ ] Add strict `DownloadDescriptorSchema`, `download.ready`, and `download_ref` contracts; collect download descriptors in the orchestrator and persist them with the assistant message.
- [ ] Include prepared reports in contextual suggested actions and provider history without exposing internal content.
- [ ] Re-run the focused tests and commit the green contract slice.

### Task 2: Add a validated export-preparation AI tool

**Files:**
- Create: `src/server/ai/tools/exportTools.ts`
- Modify: `src/server/ai/runtime.ts`
- Modify: `src/server/ai/instructions.ts`
- Test: `tests/unit/ai/exportTools.test.ts`
- Test: `tests/unit/ai/instructions.test.ts`

- [ ] Write failing tests for supported plan/evidence descriptors, unowned artifacts, unsupported map/audience artifacts, and stale revisions.
- [ ] Run the focused tests and confirm they fail because `prepareArtifactExport` is missing.
- [ ] Implement the pure descriptor builder and register strict `prepare_artifact_export` arguments in the runtime registry.
- [ ] Update system instructions so explicit export requests call the tool and no raw respondent data can be exported.
- [ ] Re-run the focused tests and commit the green tool slice.

### Task 3: Generate safe campaign and evidence reports

**Files:**
- Create: `src/server/exports/contracts.ts`
- Create: `src/server/exports/data.ts`
- Create: `src/server/exports/workbook.ts`
- Create: `src/server/exports/csv.ts`
- Modify: `src/server/evidence/repository.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `tests/unit/exports/campaignReport.test.ts`
- Test: `tests/unit/exports/evidenceReport.test.ts`

- [ ] Move `exceljs` into production dependencies.
- [ ] Write failing tests that parse generated workbooks and assert sheet names, key cells, plan options, governed evidence citations, caveats, number formats, and escaped formula-like text.
- [ ] Run the focused tests and confirm failure because report generation is missing.
- [ ] Add a bounded evidence lookup by explicit fact IDs and build normalized campaign/evidence report data.
- [ ] Implement styled XLSX generation with Summary, primary data, and Sources & limits sheets plus safe flattened CSV generation.
- [ ] Re-run the focused tests and commit the green report-generation slice.

### Task 4: Expose a protected download route

**Files:**
- Create: `src/app/api/artifacts/[artifactId]/export/route.ts`
- Test: `tests/unit/exports/exportRoute.test.ts`

- [ ] Write failing route tests for unauthenticated access, invalid/unowned artifact, stale revision, XLSX headers/signature, CSV headers/content, and no-store security headers.
- [ ] Run the focused test and confirm failure because the route does not exist.
- [ ] Implement the Node.js route with strict query parsing, owned-artifact lookup, revision/type checks, report data loading, and attachment responses.
- [ ] Re-run the focused test and commit the green route slice.

### Task 5: Render durable inline download cards

**Files:**
- Create: `src/features/chat/DownloadCard.tsx`
- Modify: `src/features/chat/ChatWorkspaceShell.tsx`
- Modify: `src/app/chat/chat.css`
- Test: `tests/component/chat/DownloadCard.test.tsx`
- Test: `tests/unit/chat/ndjson.test.ts`

- [ ] Write failing tests for accessible XLSX/CSV links, safe URL construction, reloaded `download_ref` rendering, live `download.ready` rendering, mobile wrapping, and NDJSON event parsing.
- [ ] Run the focused tests and confirm failure because the card/event handling is missing.
- [ ] Implement the compact inline card, live-event state, message rendering, and responsive Quiet Intelligence styling.
- [ ] Re-run the focused tests and commit the green UI slice.

### Task 6: Verify and deploy

**Files:**
- Modify only if verification identifies a reproducible defect.

- [ ] Run focused export, orchestrator, chat, and component tests.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:check`, `pnpm build`, and `pnpm verify:secrets` and resolve any reproducible feature regressions through a failing test first.
- [ ] Perform a browser UI/UX review at desktop and mobile widths for hierarchy, density, wrapping, keyboard access, and plain-language copy.
- [ ] Merge `codex/inline-chat-exports` into `main` only after the verification gate passes.
- [ ] Build and deploy a versioned production image using the existing MariaDB runtime configuration.
- [ ] Live-smoke campaign-plan and evidence-report chat flows, download and parse XLSX/CSV, verify unauthenticated protection, then remove smoke data.
