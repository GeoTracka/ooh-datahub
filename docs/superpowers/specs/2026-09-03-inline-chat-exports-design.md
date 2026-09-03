# Inline Chat Campaign and Evidence Exports Design

## Status

Approved on 2026-09-03.

## Goal

Let an authenticated user create campaign plans and governed evidence reports in chat, then request a polished XLSX or CSV download without leaving the conversation.

## Chosen approach

Generate exports on demand from an owned, versioned artifact. Chat prepares a durable download reference; the protected download route validates the current user, artifact owner, artifact type, and requested revision before producing bytes.

This is preferred to browser-only generation, which would duplicate data and security logic in the client, and to pre-generating files, which would add storage lifecycle and stale-file problems.

## Conversation flow

1. Existing planner and evidence tools create a versioned `plan` or `evidence` artifact.
2. The user asks for a report or export in plain language.
3. The model calls `prepare_artifact_export` with the artifact ID and expected revision.
4. The tool validates ownership, revision, and supported artifact type.
5. The orchestrator emits `download.ready` and persists a `download_ref` block with the assistant message.
6. The conversation displays a compact download card with XLSX and CSV actions.
7. The protected route revalidates the user and generates the selected format from the exact revision.

The reference remains usable after the thread is reopened. No generated file is stored and no database migration is required because message content is already JSON.

## Contract

`prepare_artifact_export` accepts:

- `artifactId`: UUID of an owned plan or evidence artifact.
- `expectedRevision`: positive integer matching the artifact's current revision.

It returns a descriptor with:

- artifact ID and revision;
- report kind (`campaign_plan` or `evidence_report`);
- a plain-language title;
- a safe base filename;
- available formats (`xlsx`, `csv`).

`download.ready` carries the same descriptor. `download_ref` persists it in message content. Both are validated with strict Zod schemas.

## Workbook contents

### Campaign plan XLSX

- `Summary`: campaign name, objective, audience, flight, budget, selected approach state, assumptions, and limitations.
- `Plan options`: the three distinct approaches, costs, estimated delivery fields, trade-offs, zones, and site identifiers available in the governed plan artifact.
- `Sources & limits`: calculation status, draft/availability warnings, artifact revision, and limitations.

### Evidence report XLSX

- `Summary`: report scope, number of approved findings, source boundary, and required caveats.
- `Findings`: fact label, value, unit, respondent base, geography, segment, period, source, workbook field or PDF page, and caveat.
- `Sources & limits`: source checksums, artifact revision, and limitations.

Workbooks use restrained Brainpad colors, clear title and section hierarchy, readable widths, frozen headers, filters, explicit formats, and hidden gridlines. CSV provides the primary flat table: plan options for plans and approved findings for evidence.

## Data and privacy boundary

- Export only the exact owned artifact revision and approved evidence facts referenced by it.
- Never export respondent rows, device metadata, precise GPS, interviewer identities, raw open text, secrets, hidden prompts, or provider payloads.
- Evidence values retain respondent base, period, geography, citation, and caveat.
- Campaign outputs remain labelled as planning estimates and drafts; availability and final rates remain unconfirmed.
- Formula-injection prefixes in exported text are escaped for CSV and stored as literal values in XLSX.

## HTTP behavior

`GET /api/artifacts/[artifactId]/export?revision=<n>&format=xlsx|csv`

- `401` when unauthenticated.
- `404` for an invalid, missing, unowned, unsupported, or mismatched revision artifact to avoid disclosing existence.
- `200` with an attachment filename, correct media type, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store` for a valid export.

The route uses the Node.js runtime because workbook generation depends on ExcelJS.

## UI

The inline card is intentionally compact: report icon, title, artifact revision, a short provenance statement, and two clear actions. It follows the existing Quiet Intelligence visual language and remains inside the assistant message rather than adding a new permanent workspace tab.

The card must be keyboard operable, expose descriptive link names, wrap cleanly on mobile, and avoid opening a new window.

## Failure handling

- Stale revisions fail closed and ask the user to prepare a fresh export.
- Missing evidence facts fail the evidence export rather than silently dropping cited rows.
- A generation error returns a concise JSON error and never leaves a misleading download reference.
- Existing campaign/evidence artifacts remain usable if export generation fails.

## Verification

- Unit tests cover descriptor validation, ownership/revision checks, XLSX/CSV structure, citations, caveats, and formula-injection escaping.
- Orchestrator tests cover `download.ready` ordering and persistence.
- Component tests cover current-turn and reloaded download cards.
- Route tests cover authentication, revision mismatch, headers, and downloadable bytes.
- Full typecheck, lint, test, build, and client-secret checks run before deployment.
- Live smoke tests create a campaign and evidence artifact in chat, prepare downloads, download both formats, parse the workbook, and confirm protected unauthenticated behavior.
