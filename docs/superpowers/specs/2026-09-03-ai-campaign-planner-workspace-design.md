# AI Campaign Planner Workspace Design

## Status

Approved product direction. This document defines the implementation boundary for the first release and the gates required before it can use the 2026 RBL/LOMA study in customer-facing recommendations.

## Goal

Add a dedicated, chat-first campaign-planning workspace where a non-specialist can describe a campaign in plain language, receive data-backed recommendations, inspect the supporting map and evidence, and fine-tune the result without being forced into a preset package.

The experience must feel calm and premium, preserve the existing deterministic planner as the source of calculated plan outputs, use the existing MariaDB service for runtime persistence, and never present disputed or unsupported research figures as facts.

## Chosen product direction

The chosen direction is **Quiet Intelligence**: a low-density conversational shell that reveals a more precise artifact workspace only when the conversation produces a plan, map, comparison, audience profile, or evidence view.

This was selected over:

1. A data-studio-first interface, which would expose more persistent metrics but would recreate the current density problem.
2. A cinematic AI interface, which would add more motion and visual effects but would reduce trust and increase performance and accessibility risk.

The existing five-step planner remains available as an expert fine-tuning surface. Chat becomes the primary entry point, not a replacement for deterministic controls.

## Primary users and jobs

### Non-specialist campaign planner

Needs to describe a product, audience, market, budget, timing, and goal without translating the request into media-planning jargon.

### Media-planning specialist

Needs to validate assumptions, inspect sources and respondent bases, compare locations, alter allocations, and move into the existing fine-tuning flow.

### Sales or strategy presenter

Needs a clean, stage-friendly view that explains why a recommendation was made without exposing implementation terminology or overwhelming the client.

## Scope decomposition

The program has four bounded workstreams. The first three form the MVP; the fourth remains gated on acquiring real source data.

1. **Data truth layer**: register, reconcile, normalize, aggregate, and cite the RBL/LOMA sources.
2. **AI planning runtime**: stream conversations, call strictly defined tools, create versioned campaign artifacts, and persist them in MariaDB.
3. **Premium chat workspace**: provide the Quiet Intelligence shell, conversation flow, artifact canvas, map, evidence, and fine-tuning handoff.
4. **Channel expansion**: radio and outdoor activations, enabled only after real inventory, audience, rate, coverage, and availability sources are governed.

The implementation plan following this design must cover workstreams 1–3 only. Workstream 4 requires separate source-specific designs.

## Current product constraints

- The live planner is sourced from `src/demo/lagos-v1/bundle.json`, whose manifest is synthetic, Lagos-only, and capped at Evidence D.
- The governed seed catalog currently contains six older OOH and FAAN workbooks. Neither 2026 RBL/LOMA source is registered.
- Persisted real seed rows are staging inputs and are intentionally not promoted into the frozen planner bundle.
- The current runtime has no OpenAI SDK, chat route, conversation store, AI tool layer, or runtime database driver.
- The historical data pipeline is PostgreSQL/PostGIS-oriented. It must not be re-platformed merely to add chat.
- New runtime state and AI read models must use the existing MariaDB deployment requested for the application.
- The project uses Next.js 16.3 with local breaking-change documentation. The relevant documents in `node_modules/next/dist/docs/` must be read before implementing routes, streaming, caching, server actions, or async request APIs.

## Source audit and data boundary

### Registered source candidates

| Source | SHA-256 | Role |
| --- | --- | --- |
| `RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx` | `780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2` | Respondent-level quantitative source |
| `RBL-LOMA OOH AUDIENCE PENETRATION Study 2026.pdf` | `a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff` | Published narrative, methodology, supply context, qualitative findings, and forecast source |

The workbook contains 1,844 respondent rows across 12 cities and 302 columns. The PDF contains 172 pages and describes quantitative, qualitative, supply, spend, traffic, and forecasting material.

### Permitted product uses

The governed study may support:

- City and audience profiles.
- Relative format preference and reported OOH attention.
- Mobility, daypart, transport, and environment context.
- Reported recall and post-ad actions, with respondent bases.
- Creative guidance.
- Normalized candidate road and area clusters.
- Qualitative city and activation guidance, clearly labelled as qualitative.
- Market supply, spend, and forecast context, with the source period and methodology shown.

### Prohibited interpretations

The study does not independently support:

- Absolute site-level reach or frequency.
- Live inventory availability or negotiated prices.
- Sensor-derived exposure.
- Causal sales lift or campaign ROI.
- A real radio station plan.
- A bookable outdoor-activation plan.
- Unqualified national-population claims.

The application must not transform respondent recall, format preference, investment-recall efficiency, or reported action into absolute campaign delivery.

### Reconciliation gates

No disputed fact is eligible for AI tools until its disposition is recorded. Initial disputes include:

1. The workbook has 302 fields while the report states 337 response variables.
2. Lagos four-week recall calculates to approximately 72.1% from the workbook response field, while the report presents 54.9% in relevant sections.
3. Kano and Abuja contain smaller denominator or transformation mismatches.
4. The workbook contains no survey-weight column or documented weighting formula.
5. The achieved city quotas are not population-proportional.
6. Nine records are aged 56 or above despite the main analytical range ending at 55.
7. Four records appear to retain the screening close response.
8. Free-text road and area values require normalization and invalid-value handling.

Until weighting documentation is available, customer-facing copy must describe the source as a **12-city urban resident and commuter study**, not as unrestricted coverage of the Nigerian population.

### Privacy boundary

Respondent-level records remain restricted. Interviewer identities, device metadata, precise interview GPS, submission metadata, and raw open text are never passed to the language model.

The AI may query only approved aggregates or pre-reviewed qualitative excerpts. Every aggregate must retain its source hash, question or metric definition, numerator, denominator, respondent base, filters, geography, period, evidence status, and caveat.

## Data architecture

### Storage layers

1. **Immutable raw source storage** keeps the exact files identified by checksum.
2. **Restricted survey layer** stores normalized respondent-level data for reproducible aggregation but is not exposed to the AI runtime.
3. **Evidence read model** stores approved aggregates and citations in MariaDB for fast, safe tool queries.
4. **Narrative evidence index** stores approved PDF passages and structured qualitative extracts. File search may assist narrative retrieval, but it is not the numerical source of truth.
5. **Planner layer** remains the deterministic source for calculated plan artifacts and current bundle outputs.

### MariaDB evidence entities

- `evidence_sources`: file identity, checksum, version, period, status, and access class.
- `evidence_metrics`: stable metric definitions and plain-language labels.
- `evidence_facts`: aggregate value, numerator, denominator, base, geography, segment, period, and evidence status.
- `evidence_citations`: source, page or workbook field, question text, and explanatory note.
- `evidence_disputes`: competing values, calculation notes, disposition, reviewer, and resolution date.
- `evidence_excerpts`: approved qualitative passages, themes, city, category, source page, and evidence label.

Disputed records use `status = blocked`. Tools must fail closed when a requested metric is blocked rather than selecting one version.

## AI runtime architecture

### API and model

- Use the OpenAI Responses API from a server-only Next.js route.
- Stream response events to the browser.
- Define every application tool with a strict JSON schema.
- Use structured outputs for plan summaries, artifact metadata, diffs, and UI actions.
- Keep the OpenAI API key on the server and out of browser bundles, client logs, and stored message content.
- Make the model configurable through environment settings rather than exposing a model selector in the first customer UI.

### Runtime MariaDB entities

- `ai_threads`: owner, title, state, created time, updated time, and archival time.
- `ai_messages`: thread, role, ordered content blocks, provider response reference, and retention status.
- `ai_tool_runs`: tool, arguments hash, status, duration, error class, result reference, and idempotency key.
- `campaign_artifacts`: stable artifact identity, owner, thread, type, and current revision.
- `campaign_artifact_revisions`: immutable structured payload, parent revision, author, reason, and created time.
- `artifact_citations`: artifact revision to evidence-citation linkage.
- `ai_usage_events`: token and request accounting without storing secrets or raw restricted records.

### Initial tool surface

Read tools:

- `search_evidence`
- `get_city_profile`
- `compare_cities`
- `get_format_scores`
- `get_mobility_context`
- `get_creative_guidance`
- `explain_plan_metric`

Plan tools:

- `build_campaign_plan`
- `adjust_campaign_plan`
- `get_plan_map`
- `save_plan`
- `open_visual_planner`

Deferred tools:

- `get_inventory_availability`
- `build_radio_plan`
- `build_activation_plan`
- supplier messaging, booking, or launch tools

Deferred tools must not be stubbed with invented data. They remain absent until their source contracts exist.

### Conversation-to-artifact flow

1. The user sends a plain-language request.
2. The server creates the user message immediately and starts a streamed response.
3. The model extracts a structured draft brief.
4. A genuinely missing decision that would materially alter the plan is asked as one concise question. Non-critical assumptions may use documented defaults and must be disclosed.
5. Evidence tools return only governed facts and citations.
6. The deterministic planner creates the calculated options and map state.
7. The model explains the result and creates or updates a versioned artifact.
8. The client opens the relevant artifact tab without replacing the conversation.
9. A fine-tuning instruction creates a new revision and a visible before/after diff.
10. The user may undo to a prior revision or open the existing visual planner with the structured plan state.

The model interprets intent and explains evidence; it does not invent reach, rates, inventory, or plan scores.

## Information architecture

### Top-level routes

- `/`: existing planner, preserved during the MVP.
- `/chat`: new chat and campaign-planning home.
- `/chat/[threadId]`: persistent conversation workspace.
- `/plans/[artifactId]`: shareable internal plan route, subject to authorization.

### Desktop workspace

```text
┌────────┬──────────────────────┬─────────────────────────────────────┐
│ Rail   │ Conversation         │ Campaign workspace                  │
│        │                      │                                     │
│ New    │ Prompt and response  │ Plan · Map · Audience · Evidence    │
│ Plans  │ Tool progress        │                                     │
│ Chats  │ Created artifacts    │ Selected artifact content           │
│ Data   │ Suggested actions    │ Optional contextual inspector        │
│        │ Fixed composer       │                                     │
└────────┴──────────────────────┴─────────────────────────────────────┘
```

- The rail is 56–64px during active work and can expand to approximately 224px.
- The conversation pane is 380–420px on wide desktop screens.
- The campaign workspace consumes the remaining width and has a practical minimum of 560px.
- A selected map object or evidence item may open a 300–340px inspector inside the workspace.
- The interface must never leave a large unexplained blank area. Before an artifact exists, the workspace is collapsed.

### Responsive behavior

- At 1024–1279px, use the narrow rail, a 340–380px conversation pane, and the remaining width for the artifact.
- At 768–1023px, the inspector becomes an overlay drawer and only two persistent content regions remain.
- Below 768px, chat and artifacts become separate views with a sticky `Chat`, `Plan`, `Map`, and `Evidence` switcher.
- Fixed composers, headers, and drawers must reserve scroll padding so they never cover content.

## Core experience states

### Chat home

- Short greeting and a prominent composer.
- Three context-aware starter prompts at most.
- Recent plans and conversations remain in the rail.
- Do not place a full analytics dashboard above the first prompt.
- Usage and account controls remain secondary.

### Active conversation

- User messages use a restrained tinted surface.
- AI prose is primarily unboxed for readability.
- Tool activity appears as compact, collapsible progress rows with elapsed time and status.
- Sources are shown inline near the claim they support.
- Artifacts created in the turn appear as typed links: `PLAN`, `MAP`, `COMPARISON`, or `EVIDENCE`.
- Suggested next actions contain no more than three items and appear immediately above the composer.

### Long-running work

Display named, user-understandable stages such as:

```text
Building your campaign plan

✓ Understood the campaign brief
✓ Compared city audience evidence
● Building three media options
○ Preparing map
```

Do not expose hidden chain-of-thought. A tool trace may show the source read, tool name in plain language, duration, and outcome.

Parallel tasks must surface `ready`, `needs attention`, `stalled`, or `failed`. Partial results remain usable.

### Draft and consequential actions

Plans remain drafts until a separate launch or supplier workflow exists. The UI must repeatedly preserve these distinctions:

- Draft, not booked.
- No supplier message sent.
- Inventory availability unconfirmed.
- User changes are reversible.
- Nothing locks until a future confirmed action.

## Artifact design

### Plan artifact

A readable campaign document, not a grid of KPI cards. It contains:

- Campaign objective.
- Audience definition.
- Assumptions.
- City strategy.
- Three or more recommended package approaches when supported.
- User-selected or fine-tuned package.
- Budget allocation.
- Timing and daypart.
- Creative guidance.
- Measurement approach and limitations.
- Evidence summary and citations.

Recommendations do not force selection. The user can compare, combine, reject, or fine-tune packages.

### Map artifact

- Uses the existing MapLibre foundation and existing planner map contracts.
- Opens as a real, usable map rather than an empty right-side panel.
- Uses a muted basemap so campaign layers dominate.
- Has compact layer controls and a visible legend.
- Selecting a city, zone, or site opens the contextual inspector.
- `Why this location?` opens evidence in the inspector rather than a stacked modal.
- Chat-driven map updates preserve the current camera unless the user explicitly requests focus or the selected geography changes.
- Every mapped insight has a text or table fallback.

### Audience artifact

- Segment summary.
- Demographic context.
- Mobility, transport, daypart, and environment signals.
- Format preference and creative triggers.
- Reported recall and actions with bases.
- City comparison.

Use horizontal bars for precise category comparisons. Radar charts are limited to two or three entities and five to eight dimensions, with a grouped-bar or table alternative.

### Evidence artifact

Every quantitative entry provides:

- Plain-language metric name.
- Value.
- Respondent base.
- City and segment filters.
- Source and field or page citation.
- Evidence type.
- Caveat.
- Reconciliation status.

Blocked metrics are shown only in an administrative reconciliation view, not in customer-facing recommendations.

### Contextual inspector

The inspector is selection-driven and never permanently consumes space. It supports:

- Selected city or site details.
- Exact metric values.
- Source citations.
- Package contribution.
- Before/after allocation change.
- Close and return-to-selection behavior.

## Quiet Intelligence visual system

### Color tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#f6f5f2` | Warm application background |
| Surface | `#ffffff` | Primary content surfaces |
| Surface subtle | `#f0f1ee` | User prompts, selected navigation, grouped controls |
| Text primary | `#17231f` | Headings and body |
| Text secondary | `#68726d` | Supporting copy |
| Border | `rgb(23 35 31 / 11%)` | Hairline structure |
| Brand | `#145c54` | Primary action and selection |
| Brand strong | `#0f4942` | Hover and high-emphasis brand state |
| Evidence accent | `#9a7209` | Evidence and qualified highlights |
| Success | `#16805a` | Ready and complete |
| Warning | `#b66710` | Needs attention and stalled |
| Error | `#b63b36` | Failed and destructive |

Origami's pink accent is not copied. The current forest-green identity remains primary.

### Typography

- Inter remains the UI, table, and body typeface.
- A restrained editorial display face, preferably Newsreader through `next/font`, may be used only for the chat-home greeting and major plan titles.
- Body copy uses at least 16px on mobile and a 1.5–1.65 line height.
- Conversation text is limited to approximately 65–75 characters per line.
- Budgets, counts, bases, percentages, and scores use tabular figures.
- Uppercase is reserved for short artifact types and evidence/status labels.

### Radius and elevation

- Controls: 8px.
- Embedded sections: 10–12px.
- Composer and major floating surfaces: 14–16px.
- Pills are reserved for statuses, filters, and evidence labels.
- Embedded cards use borders rather than shadow.
- A single subtle shadow token is used for floating controls and a stronger token for drawers and popovers.
- Blur is used only to separate a modal or drawer from its background, never as decoration.

### Motion

- Control feedback: 100–160ms.
- Pane transitions: approximately 220ms.
- Artifact reveal: 240–300ms.
- Exit transitions are 60–70% of the corresponding entrance duration.
- Animate only transforms and opacity for primary layout transitions.
- Updated numbers or allocations briefly highlight without shifting layout.
- Animations are interruptible and never block input.
- `prefers-reduced-motion` removes pane travel, stagger, map fly-to, and non-essential chart animation.

## Component boundaries

New feature units should remain independently testable:

- `ChatWorkspaceShell`: responsive rail, conversation, artifact canvas, and inspector layout.
- `WorkspaceRail`: new conversation, recent chats, saved plans, and settings links.
- `ConversationPane`: ordered messages, progress, artifacts created this turn, suggestions, and composer.
- `ChatComposer`: autosizing input, attachment affordance, send state, and accessible shortcuts.
- `ToolProgress`: collapsible user-facing tool stages and recovery actions.
- `ArtifactTabs`: persistent plan, map, audience, comparison, and evidence tabs.
- `CampaignPlanView`: readable plan document and package options.
- `CampaignMapView`: adapter over existing map components and structured map state.
- `AudienceEvidenceView`: accessible charts, summaries, and table fallbacks.
- `EvidenceInspector`: exact fact, base, source, caveat, and status.
- `ArtifactRevisionDiff`: before/after values, reason, undo, and revision selection.
- `SuggestedActions`: at most three contextual actions.

Planner calculation and AI orchestration must not live inside React presentation components. Existing map and planner logic should be adapted through stable service contracts rather than duplicated.

## Suggested dependencies

Required additions, subject to compatibility verification against Next.js 16.3 documentation:

- `openai`: Responses API and strict tool calls.
- `drizzle-orm` and `mysql2`: typed MariaDB runtime access and migrations.
- `react-markdown` and `remark-gfm`: controlled rendering of conversational prose.
- `lucide-react`: consistent accessible icon family.

Recommended only where the implementation earns their cost:

- `react-resizable-panels`: keyboard-aware desktop split panes.
- `@tanstack/react-virtual`: long conversation and evidence-table virtualization.
- `motion`: coordinated pane and artifact transitions. CSS transitions remain acceptable if the required continuity is achievable without it.

Do not add LangChain to the MVP. The initial tool graph is small, explicit, and better served by the OpenAI SDK plus application-owned orchestration.

## Error and recovery design

### Provider unavailable

Keep the user's message, show a concise service error, and offer retry. Do not create an empty assistant message or lose the draft brief.

### Evidence unavailable or disputed

Explain that the requested metric is not currently approved. Offer a supported relative comparison or ask the user to continue without that metric.

### Planner failure

Preserve the evidence summary and brief. Mark the plan artifact as incomplete and allow deterministic planning to be retried without repeating evidence retrieval.

### Partial tool failure

Show completed stages and the failed stage. A city comparison with one unavailable city remains viewable and clearly incomplete.

### MariaDB write failure

Do not claim a chat or plan was saved. Keep the current browser state available for retry and prevent subsequent revisions from referencing a nonexistent persisted parent.

### Stale revision

Reject conflicting mutation with a clear refresh or compare action. Never silently overwrite a newer artifact revision.

## Trust, safety, and data controls

- Authenticate every chat and artifact route.
- Enforce thread and artifact ownership in server queries.
- Rate-limit chat requests and expensive tool calls by user and project.
- Treat retrieved documents and workbook text as untrusted data, never as tool instructions.
- Maintain a strict server-side tool allowlist.
- Validate all model-generated tool arguments with Zod before execution.
- Apply idempotency keys to plan-building and adjustment tools.
- Do not log API keys, raw respondent rows, precise GPS, or full provider payloads.
- Define message and provider-response retention explicitly; deletion must remove application records and associated provider-side resources where applicable.
- Record source hashes and artifact citations so a recommendation is reproducible after source updates.
- No external booking, supplier communication, or campaign launch is in the MVP.

## Performance requirements

- The sent user message appears in the conversation within 100ms of local submission.
- The UI shows a working or queued state within 300ms.
- The first streamed content should normally appear within three seconds under healthy provider and network conditions.
- The initial `/chat` bundle does not eagerly load MapLibre or heavy evidence views.
- Map and chart artifacts use dynamic loading and reserved dimensions to prevent layout shift.
- Conversations and tables over 50 rendered items are virtualized or paginated.
- Streaming updates are batched to avoid per-token layout work.
- The composer and scroll position remain responsive while tools run.

## Accessibility requirements

- All functions are keyboard operable.
- Focus order follows rail, conversation, artifact tabs, artifact content, and inspector.
- Opening an artifact or inspector moves focus only when initiated by the user; background tool completion does not steal focus.
- Closing a drawer or inspector restores focus to its trigger.
- Status, warning, failure, evidence grade, and selection are never conveyed by color alone.
- Tool progress and new assistant content use appropriately scoped `aria-live` regions without announcing every streamed token.
- Maps and charts provide text summaries and table alternatives.
- Icon-only controls have accessible names and at least a 44px target.
- Contrast meets WCAG AA.
- Zoom, text scaling, and reduced motion remain supported.

## Testing and evaluation

### Data tests

- Checksum and source-catalog verification.
- Workbook schema and row-count guards.
- Reproducible aggregate calculations.
- Numerator, denominator, and base checks.
- City and segment filter tests.
- Disputed-fact fail-closed tests.
- Privacy tests proving restricted columns cannot enter AI tool results.

### Runtime tests

- Strict tool-schema validation.
- Tool idempotency and retry behavior.
- Conversation ownership and authorization.
- Artifact revision consistency and undo.
- MariaDB transaction and conflict handling.
- Provider timeout, cancellation, and partial stream recovery.

### Model evaluations

Maintain a fixed prompt set across city, sector, objective, budget, timing, and evidence questions. Score:

- Citation correctness.
- Numerical faithfulness.
- Unsupported-claim rate.
- Correct use of respondent bases and caveats.
- Refusal to turn relative survey evidence into absolute reach.
- Deterministic consistency between the chat artifact and planner output.
- Correct handling of blocked metrics.
- Plain-language quality.

### UI tests

- Component tests for composer, progress, artifact tabs, evidence inspector, revision diff, and responsive shell.
- End-to-end flow from new chat to three package options, map inspection, fine-tuning, undo, and visual-planner handoff.
- End-to-end provider failure and tool partial-failure flows.
- Visual regression at 375px, 768px, 1024px, and 1440px.
- Keyboard-only and screen-reader smoke tests.
- Reduced-motion and high-text-scaling tests.
- Verify the right-side map is populated whenever the map artifact is selected and has a useful fallback when map data is unavailable.

### UI/UX quality review gate

Each customer-facing slice requires a focused review against the approved Quiet Intelligence direction before it can merge or deploy. The review must use representative data and cover:

- Visual hierarchy, density, whitespace, typography, and consistency with the defined tokens.
- Plain-language copy and removal of internal, synthetic, or demo-sounding terminology.
- Complete default, loading, streaming, empty, partial, error, and recovery states.
- Real-map rendering, resize behavior, selection context, legend clarity, and text fallback.
- Recommendation distinctness: at least three meaningfully different approaches when supported, with clear trade-offs and no forced choice.
- Fine-tuning discoverability, reversibility, revision feedback, and continuity into the existing planner.
- Keyboard, focus, screen-reader, reduced-motion, contrast, zoom, and touch-target behavior.
- Visual regression evidence across the required breakpoints, followed by a browser walkthrough on the deployed candidate.

Review findings are tracked as blocking, major, or polish. Blocking and major findings must be resolved and rechecked before deployment; polish findings may be explicitly deferred with an owner and rationale.

## Delivery sequence and gates

### Phase 0: Data truth

- Register both source hashes.
- Land immutable source copies through the governed path.
- Create the data dictionary and restricted normalization layer.
- Resolve or block every identified discrepancy.
- Materialize safe MariaDB evidence facts and citations.
- Pass reproducibility and privacy tests.

**Gate:** no study-backed AI claim ships before this phase passes.

### Phase 1: Read-only AI workspace

- Add MariaDB chat persistence.
- Add the streamed OpenAI route and read-only evidence tools.
- Build the Quiet Intelligence shell, messages, tool progress, citations, and evidence artifact.
- Do not create or alter planner packages yet.

**Gate:** model evaluations show no unsupported absolute reach, inventory, radio, or activation claims.

### Phase 2: Plan and map artifacts

- Add deterministic planner tools.
- Produce three or more package approaches when the inventory and request support them.
- Add Plan, Map, Audience, and Evidence artifacts.
- Keep package selection optional.

**Gate:** chat artifacts and existing planner calculations match for the same structured input.

### Phase 3: Fine-tuning and handoff

- Add versioned adjustments, diffs, undo, saved plans, and visual-planner handoff.
- Add shareable internal plan routes and artifact history.

**Gate:** no revision can silently overwrite another revision or lose its citations.

### Deferred: Radio and activations

Radio requires a governed station registry, coverage, audience or listenership methodology, dayparts, rates, formats, and availability. Outdoor activations require structured venue or route inventory, permissions, capacity, audience or footfall evidence, rates, operating constraints, and availability.

Qualitative study passages may inform creative ideas but cannot substitute for these operational datasets.

## Acceptance criteria

The MVP is complete only when:

1. A user can create, reopen, rename, and continue a persisted chat.
2. A plain-language campaign request can generate supported package approaches and a versioned plan artifact.
3. The right-side Map artifact displays a real map state rather than a blank region.
4. The user can inspect audience and evidence without leaving the chat workspace.
5. Every study-derived quantitative claim exposes a base and citation.
6. Blocked or disputed metrics cannot be used by the model or planner tools.
7. The AI does not invent inventory, prices, reach, radio data, activation data, or ROI.
8. The user can reject recommendations and fine-tune freely.
9. Fine-tuning produces a reversible revision diff and preserves deterministic calculations.
10. The existing planner remains available and receives the same structured plan state.
11. The workspace passes the responsive, keyboard, reduced-motion, failure, and visual quality tests defined above.
12. All new runtime persistence uses MariaDB; the existing PostGIS-oriented seed tooling is not introduced as a runtime dependency.

## Out of scope for the MVP

- Autonomous booking or purchasing.
- Sending supplier messages.
- Campaign launch.
- A radio-station planner.
- A bookable activation planner.
- Respondent-level natural-language querying.
- Exposing raw GPS or interviewer metadata.
- Replacing the spatial preprocessing pipeline with MariaDB.
- Dark mode.
- Voice-first interaction beyond a future-compatible composer affordance.
- A generalized no-code agent builder.

## Implementation-plan boundary

After the user approves this written specification, the implementation plan should decompose work into independently verifiable slices in this order:

1. Source registration and reconciliation.
2. MariaDB evidence read model.
3. MariaDB chat and artifact persistence.
4. OpenAI streamed runtime and read-only tools.
5. Quiet Intelligence shell and evidence artifact.
6. Deterministic planner and map tools.
7. Plan, Map, Audience, and Evidence artifacts.
8. Fine-tuning revisions, undo, and visual-planner handoff.
9. Evaluation, accessibility, responsive, visual-regression, and deployment gates.
