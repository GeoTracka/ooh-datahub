# Quiet Intelligence Campaign Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the premium, responsive chat workspace where users create data-backed plans, inspect a real map and evidence, compare three approaches, and fine-tune without a forced package choice.

**Architecture:** A responsive `ChatWorkspaceShell` owns rail, conversation, artifact canvas, and contextual inspector. It consumes versioned NDJSON events and immutable artifact revisions from the runtime; heavy MapLibre and long-list code loads only when needed, while all planning math stays in server tools and the existing planner service.

**Tech Stack:** Next.js 16.3, React 19, CSS custom properties, Inter/Newsreader via `next/font`, Lucide, react-resizable-panels, TanStack Virtual, react-markdown, MapLibre, Testing Library, Playwright, axe.

---

## File map

- `src/app/(planner)/*`: route group preserving the existing five-step planner and route-scoped map assets.
- `src/app/chat/page.tsx`: protected chat home.
- `src/app/chat/[threadId]/page.tsx`: protected persistent workspace with promise params and Suspense.
- `src/app/chat/loading.tsx`: static shell fallback.
- `src/app/chat/chat.css`: Quiet Intelligence tokens and responsive layout.
- `src/features/chat/ChatWorkspaceShell.tsx`: four-region desktop and switched mobile shell.
- `src/features/chat/WorkspaceRail.tsx`: new chat, history, saved plans, account.
- `src/features/chat/ConversationPane.tsx`: messages, progress, artifact links, suggestions, composer.
- `src/features/chat/ChatComposer.tsx`: autosizing input, accessible send, pending/cancel state.
- `src/features/chat/useChatStream.ts`: NDJSON parsing, cancellation, optimistic user message, recovery.
- `src/features/chat/artifacts/*`: Plan, Map, Audience, Evidence, inspector, and revision diff.
- `src/content/aiPlannerCopy.ts`: plain-language labels and recovery copy.
- `tests/component/chat/*`: state and accessibility component tests.
- `tests/fixtures/chatWorkspace.ts`: typed chat, artifact, stream, map, evidence, and revision fixtures shared by UI tests.
- `tests/e2e/chat-*.spec.ts`: functional, responsive, recovery, map, and quality review.

### Task 1: Route heavy planner assets away from the chat home

**Files:**
- Move: `src/app/page.tsx` → `src/app/(planner)/page.tsx`
- Create: `src/app/(planner)/layout.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/component/RootLayout.test.tsx`

- [ ] **Step 1: Write the root-layout performance test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("does not preload the map for non-map routes", () => {
    const { container } = render(<RootLayout><div>Chat</div></RootLayout>);
    expect(container.querySelector('link[rel="preload"][href*="map"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/RootLayout.test.tsx`

Expected: FAIL because root layout still preloads map context.

- [ ] **Step 3: Create the route group**

Keep `/` unchanged by moving its page into `(planner)`. Move MapLibre CSS, explorer CSS imports, and the map-context preload into `(planner)/layout.tsx`. Keep `globals.css`, metadata, and `ModalFocusContainment` in the root layout. The planner layout returns its children unchanged apart from the route-scoped preload link.

- [ ] **Step 4: Run and commit**

Run:

```powershell
pnpm test -- tests/component/RootLayout.test.tsx tests/component/PlannerPage.test.tsx
pnpm typecheck
pnpm build
```

Expected: PASS and `/` still builds.

```powershell
git add src/app tests/component/RootLayout.test.tsx
git commit -m "perf: scope planner map assets to planner route"
```

### Task 2: Add the Quiet Intelligence tokens and protected chat routes

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/chat/layout.tsx`
- Create: `src/app/chat/page.tsx`
- Create: `src/app/chat/[threadId]/page.tsx`
- Create: `src/app/plans/[artifactId]/page.tsx`
- Create: `src/app/chat/loading.tsx`
- Create: `src/app/chat/chat.css`
- Create: `src/content/aiPlannerCopy.ts`
- Create: `tests/component/chat/ChatRoutes.test.tsx`

- [ ] **Step 1: Write route-shell tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatLoading from "@/app/chat/loading";

describe("chat route shell", () => {
  it("shows a meaningful loading state without fake progress", () => {
    render(<ChatLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening your planning workspace");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/ChatRoutes.test.tsx`

Expected: FAIL because chat routes do not exist.

- [ ] **Step 3: Configure fonts and semantic tokens**

Use `Inter` for UI/body and `Newsreader` only for the chat greeting and major plan title. Expose their variables from the root body. Define these route tokens in `chat.css`:

```css
.ai-workspace {
  --ai-canvas: #f6f5f2;
  --ai-surface: #ffffff;
  --ai-surface-subtle: #f0f1ee;
  --ai-text: #17231f;
  --ai-text-muted: #68726d;
  --ai-border: rgb(23 35 31 / 11%);
  --ai-brand: #145c54;
  --ai-brand-strong: #0f4942;
  --ai-evidence: #9a7209;
  --ai-success: #16805a;
  --ai-warning: #b66710;
  --ai-error: #b63b36;
  --ai-focus: #2d7f76;
  --ai-radius-control: 8px;
  --ai-radius-section: 12px;
  --ai-radius-floating: 16px;
  --ai-shadow-floating: 0 10px 28px rgb(23 35 31 / 10%);
  min-height: 100dvh;
  background: var(--ai-canvas);
  color: var(--ai-text);
}
```

Add visible `:focus-visible`, 44px minimum control size, 16px mobile inputs, 1.5+ body line height, tabular numerals, and reduced-motion overrides. Do not add dark mode or pink/purple AI gradients.

- [ ] **Step 4: Implement protected server pages**

`/chat` calls `requireUser()`, loads recent owned threads/plans, and renders the empty workspace with exactly three starter prompts. `/chat/[threadId]` accepts `params: Promise<{ threadId: string }>` through `PageProps<'/chat/[threadId]'>`, awaits inside a Suspense-wrapped server component, validates ownership, and returns `notFound()` for inaccessible IDs. `/plans/[artifactId]` follows the same promise-param and ownership pattern and renders the current plan revision as a protected internal share route.

- [ ] **Step 5: Run and commit**

Run:

```powershell
pnpm test -- tests/component/chat/ChatRoutes.test.tsx
pnpm typecheck
pnpm build
```

Expected: PASS.

```powershell
git add src/app src/content/aiPlannerCopy.ts tests/component/chat/ChatRoutes.test.tsx
git commit -m "feat: add protected Quiet Intelligence routes"
```

### Task 3: Build the responsive workspace shell and navigation

**Files:**
- Create: `src/features/chat/contracts.ts`
- Create: `src/features/chat/ChatWorkspaceShell.tsx`
- Create: `src/features/chat/WorkspaceRail.tsx`
- Create: `src/features/chat/ArtifactTabs.tsx`
- Create: `tests/component/chat/ChatWorkspaceShell.test.tsx`
- Create: `tests/fixtures/chatWorkspace.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install earned layout dependencies**

Run:

```powershell
pnpm add react-resizable-panels @tanstack/react-virtual
```

Use resizable panels only at 1024px and above. Use virtualization only after 50 rendered messages or evidence rows.

- [ ] **Step 2: Write shell state tests**

Create `tests/fixtures/chatWorkspace.ts` and export `emptyThread`, `thread`, `planArtifact`, `threeOptionPlan`, `mapArtifact`, `mapArtifactWithoutGeometry`, `evidenceArtifact`, `audienceArtifact`, `planRevision3`, `revisionApi`, and `partialFailureStream`. Build all artifact values with `ArtifactPayloadSchema.parse(...)` and all stream values with `ChatServerEventSchema.parse(...)` so fixture drift fails at test startup.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";

describe("ChatWorkspaceShell", () => {
  it("collapses the empty artifact region and opens it when an artifact exists", async () => {
    const { rerender } = render(<ChatWorkspaceShell initialThread={emptyThread} artifacts={[]} />);
    expect(screen.queryByRole("region", { name: "Campaign workspace" })).not.toBeInTheDocument();
    rerender(<ChatWorkspaceShell initialThread={emptyThread} artifacts={[planArtifact]} />);
    expect(screen.getByRole("region", { name: "Campaign workspace" })).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Plan" }));
    expect(screen.getByRole("tab", { name: "Plan" })).toHaveAttribute("aria-selected", "true");
  });
});
```

- [ ] **Step 3: Run and verify failure**

Run: `pnpm test -- tests/component/chat/ChatWorkspaceShell.test.tsx`

Expected: FAIL because shell components do not exist.

- [ ] **Step 4: Implement the layout contract**

Desktop uses a 56–64px rail, 380–420px conversation pane, remaining artifact canvas, and optional 300–340px inspector. The empty artifact canvas is not rendered. At 1024–1279px use a narrow rail and 340–380px conversation. At 768–1023px replace the inspector with an overlay drawer. Below 768px render one content view at a time and a sticky four-item `Chat`, `Plan`, `Map`, `Evidence` switcher. Preserve scroll position per view.

Rail items use Lucide icons plus accessible names; expanded mode shows text labels. `New plan` is the sole primary rail action. Thread rows support reopen and inline rename; delete requires confirmation and calls the owned-thread DELETE route. Archived and account actions stay in an overflow menu.

- [ ] **Step 5: Run and commit**

Run: `pnpm test -- tests/component/chat/ChatWorkspaceShell.test.tsx`

Expected: PASS.

```powershell
git add package.json pnpm-lock.yaml src/features/chat src/app/chat/chat.css tests/component/chat/ChatWorkspaceShell.test.tsx
git commit -m "feat: build responsive AI workspace shell"
```

### Task 4: Implement messages, progress, composer, and NDJSON streaming

**Files:**
- Create: `src/features/chat/ConversationPane.tsx`
- Create: `src/features/chat/ChatComposer.tsx`
- Create: `src/features/chat/ToolProgress.tsx`
- Create: `src/features/chat/SuggestedActions.tsx`
- Create: `src/features/chat/useChatStream.ts`
- Create: `src/features/chat/MarkdownMessage.tsx`
- Create: `tests/component/chat/ConversationPane.test.tsx`
- Create: `tests/unit/chat/ndjson.test.ts`

- [ ] **Step 1: Write optimistic and partial-failure tests**

```tsx
it("keeps the user message and completed artifact when a later tool fails", async () => {
  render(<ConversationPane thread={thread} streamFactory={partialFailureStream} />);
  await userEvent.type(screen.getByLabelText("Describe your campaign"), "Compare Lagos formats");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(screen.getByText("Compare Lagos formats")).toBeVisible();
  expect(await screen.findByRole("link", { name: /EVIDENCE/ })).toBeVisible();
  expect(await screen.findByRole("alert")).toHaveTextContent("Some evidence could not be loaded");
  expect(screen.getByRole("button", { name: "Retry incomplete step" })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/ConversationPane.test.tsx tests/unit/chat/ndjson.test.ts`

Expected: FAIL because conversation components do not exist.

- [ ] **Step 3: Implement the stream reducer**

Parse arbitrary chunk boundaries into newline-delimited events with `TextDecoder({ fatal: true })`, retain an incomplete trailing line until the next chunk, and validate each object with `ChatServerEventSchema`. State transitions must be:

```ts
type StreamState = {
  phase: "idle" | "connecting" | "streaming" | "completed" | "failed";
  optimisticMessageId: string | null;
  assistantText: string;
  toolRuns: Array<{ runId: string; label: string; status: "running" | "ready" | "needs_attention" | "stalled" | "completed" | "failed"; durationMs: number | null }>;
  createdArtifacts: Array<{ artifactId: string; type: ArtifactType; revision: number }>;
  error: { code: string; recoverable: boolean } | null;
};
```

- [ ] **Step 4: Implement accessible conversation presentation**

AI prose is unboxed; user messages use the subtle surface. Render Markdown with raw HTML disabled and an allowlist for paragraphs, headings, lists, links, tables, emphasis, and code. External links use safe `rel`. Tool rows expose plain labels and duration, not hidden reasoning. `aria-live="polite"` announces stage changes and final response only, not every token.

The composer auto-sizes to a bounded six lines, supports Enter to send and Shift+Enter for newline, disables duplicate send, exposes a cancel action while streaming, preserves unsent text on failure, and has a persistent visible label for screen readers. Suggestions are limited to three.

- [ ] **Step 5: Run and commit**

Run:

```powershell
pnpm test -- tests/component/chat/ConversationPane.test.tsx tests/unit/chat/ndjson.test.ts
pnpm typecheck
```

Expected: PASS.

```powershell
git add src/features/chat tests/component/chat tests/unit/chat
git commit -m "feat: stream campaign conversations"
```

### Task 5: Build the Plan artifact with optional recommendations

**Files:**
- Create: `src/features/chat/artifacts/CampaignPlanView.tsx`
- Create: `src/features/chat/artifacts/PlanOptionCard.tsx`
- Create: `src/features/chat/artifacts/ArtifactRevisionDiff.tsx`
- Create: `tests/component/chat/CampaignPlanView.test.tsx`

- [ ] **Step 1: Write recommendation-choice tests**

```tsx
it("shows three distinct approaches without preselecting or forcing one", async () => {
  render(<CampaignPlanView artifact={threeOptionPlan} />);
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.getByRole("radio", { name: /Balanced plan/ })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: /Highest delivery/ })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: /Budget-smart plan/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Fine-tune plan" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Keep exploring" })).toBeEnabled();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/CampaignPlanView.test.tsx`

Expected: FAIL because the Plan artifact does not exist.

- [ ] **Step 3: Implement the readable plan document**

Order content as objective, audience, assumptions, three approaches, city strategy, budget/timing, creative guidance, measurement, limitations, and evidence. Each approach must have a different title, purpose, locations, budget, expected trade-offs, evidence status, and `Compare` action. Use a semantic radio group only when the user chooses; initial value is `null`. `Fine-tune plan` remains available without selection and opens change controls based on the current best-overall plan. Keep `Draft, not booked`, `Inventory availability unconfirmed`, and `No supplier message sent` visible near the plan status.

Revision changes display exact before/after values, reason, timestamp, `Undo`, and `View previous revision`. Updated values briefly highlight without moving layout.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/component/chat/CampaignPlanView.test.tsx`

Expected: PASS.

```powershell
git add src/features/chat/artifacts tests/component/chat/CampaignPlanView.test.tsx
git commit -m "feat: present three optional campaign approaches"
```

### Task 6: Build the real Map artifact and contextual inspector

**Files:**
- Create: `src/features/chat/artifacts/CampaignMapView.tsx`
- Create: `src/features/chat/artifacts/CampaignMapClient.tsx`
- Create: `src/features/chat/artifacts/EvidenceInspector.tsx`
- Create: `src/features/chat/artifacts/mapArtifactScene.ts`
- Modify: `src/maps/MapCanvas.tsx`
- Create: `tests/component/chat/CampaignMapView.test.tsx`
- Create: `tests/unit/chat/mapArtifactScene.test.ts`

- [ ] **Step 1: Write visible-map and fallback tests**

```tsx
it("renders a labelled campaign map instead of a blank canvas", async () => {
  render(<CampaignMapView artifact={mapArtifact} />);
  expect(await screen.findByRole("region", { name: "Campaign map" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Map layers" })).toBeVisible();
  expect(screen.getByText("Campaign locations")).toBeVisible();
});

it("shows a useful location table when map data is unavailable", () => {
  render(<CampaignMapView artifact={mapArtifactWithoutGeometry} />);
  expect(screen.getByText("The map is unavailable, but your selected locations are still listed below.")).toBeVisible();
  expect(screen.getByRole("table", { name: "Campaign locations" })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/CampaignMapView.test.tsx tests/unit/chat/mapArtifactScene.test.ts`

Expected: FAIL because Map artifact components do not exist.

- [ ] **Step 3: Implement lazy map loading and existing-contract adaptation**

Load `CampaignMapClient` with `next/dynamic` and `ssr: false` only when the Map tab is selected. Convert artifact zone/site IDs into existing `SpatialFeature[]`, pass through `projectMapLibreScene`, and render with `MapCanvas`. Add optional `ariaLabel` to `MapCanvas`, defaulting to `Map`; the artifact supplies `Campaign map`.

Give the map a reserved `min-height: clamp(360px, 58vh, 760px)`, `ResizeObserver`-driven resize, muted basemap, visible attribution, compact layer control, visible legend, and selected-feature state. Preserve camera on chat updates unless geography changes or the user chooses `Focus selected`.

- [ ] **Step 4: Implement the inspector and fallback**

Map selection opens city/site label, exact plan contribution, package membership, supporting fact citations, and `Why this location?`. Desktop inspector is inline; tablet/mobile is a focus-managed drawer. Always render a sortable text table with location, format, package, budget contribution, and evidence status below or beside the map.

- [ ] **Step 5: Run and commit**

Run:

```powershell
pnpm test -- tests/component/chat/CampaignMapView.test.tsx tests/unit/chat/mapArtifactScene.test.ts tests/component/MapCanvas.test.tsx
pnpm typecheck
```

Expected: PASS.

```powershell
git add src/features/chat/artifacts src/maps/MapCanvas.tsx tests/component/chat tests/unit/chat tests/component/MapCanvas.test.tsx
git commit -m "feat: render campaign map and evidence inspector"
```

### Task 7: Build Audience and Evidence artifacts

**Files:**
- Create: `src/features/chat/artifacts/AudienceEvidenceView.tsx`
- Create: `src/features/chat/artifacts/EvidenceView.tsx`
- Create: `src/features/chat/artifacts/AccessibleBarChart.tsx`
- Create: `tests/component/chat/EvidenceViews.test.tsx`

- [ ] **Step 1: Write citation and chart-fallback tests**

```tsx
it("shows every quantitative claim with its base, caveat, and source", () => {
  render(<EvidenceView artifact={evidenceArtifact} />);
  expect(screen.getByText("Base: 152 respondents")).toBeVisible();
  expect(screen.getByText(/unweighted 12-city urban resident and commuter study/i)).toBeVisible();
  expect(screen.getByRole("link", { name: /Workbook field/ })).toBeVisible();
});

it("pairs charts with a data table", () => {
  render(<AudienceEvidenceView artifact={audienceArtifact} />);
  expect(screen.getByRole("img", { name: /Format comparison/ })).toBeVisible();
  expect(screen.getByRole("table", { name: /Format comparison data/ })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/EvidenceViews.test.tsx`

Expected: FAIL because evidence views do not exist.

- [ ] **Step 3: Implement evidence-first presentation**

Audience shows segment summary, demographic context, mobility/transport/daypart/environment signals, format preference, creative triggers, reported actions, and city comparison. Use accessible horizontal bars for exact comparisons. Use radar only for 2–3 entities and 5–8 dimensions and always provide grouped bars/table.

Evidence rows show label, value, base, filters, period, source field/page, evidence type, caveat, and reconciliation status. Never render blocked metrics in customer views. Long evidence tables virtualize after 50 rows without breaking keyboard reading order.

- [ ] **Step 4: Run and commit**

Run: `pnpm test -- tests/component/chat/EvidenceViews.test.tsx`

Expected: PASS.

```powershell
git add src/features/chat/artifacts tests/component/chat/EvidenceViews.test.tsx
git commit -m "feat: add audience and evidence artifacts"
```

### Task 8: Connect fine-tuning, undo, and visual-planner handoff

**Files:**
- Create: `src/features/chat/artifacts/FineTunePanel.tsx`
- Create: `src/features/chat/artifacts/useArtifactRevision.ts`
- Modify: `src/features/PlannerPage.tsx`
- Modify: `src/app/(planner)/page.tsx`
- Create: `tests/component/chat/FineTunePanel.test.tsx`
- Modify: `tests/component/PlannerPage.test.tsx`

- [ ] **Step 1: Write reversible-change tests**

```tsx
it("applies a change as a new revision and can undo it", async () => {
  render(<FineTunePanel artifact={planRevision3} api={revisionApi} />);
  await userEvent.clear(screen.getByLabelText("Budget (NGN)"));
  await userEvent.type(screen.getByLabelText("Budget (NGN)"), "20000000");
  await userEvent.click(screen.getByRole("button", { name: "Apply change" }));
  expect(await screen.findByText("₦18M → ₦20M")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Undo this change" }));
  expect(await screen.findByText("Restored revision 3")).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm test -- tests/component/chat/FineTunePanel.test.tsx`

Expected: FAIL because fine-tuning components do not exist.

- [ ] **Step 3: Implement explicit revision mutations**

Each mutation sends artifact ID, expected parent revision, one structured change, and a plain-language reason. Disable only conflicting controls while saving. On 409, show `A newer version exists` with `Compare versions` and `Reload latest`; never overwrite silently. Undo creates a new revision whose payload equals the selected prior revision and whose reason states the restore source.

- [ ] **Step 4: Implement the planner handoff**

`Open visual planner` requests a short-lived handoff token, navigates to `/?handoff=<token>`, and the server page validates ownership then passes the exact `PlanningResult` into `PlannerPage` as `initialPlan`. `PlannerPage` initializes reducer state, brief, selected zone, and Step 5 from that prop. The existing planner remains usable without a handoff.

- [ ] **Step 5: Run and commit**

Run:

```powershell
pnpm test -- tests/component/chat/FineTunePanel.test.tsx tests/component/PlannerPage.test.tsx
pnpm typecheck
```

Expected: PASS.

```powershell
git add src/features/chat/artifacts src/features/PlannerPage.tsx src/app/'(planner)' tests/component
git commit -m "feat: connect AI plans to visual fine tuning"
```

### Task 9: Add responsive, accessibility, failure, and UI-quality gates

**Files:**
- Create: `tests/e2e/chat-workspace.spec.ts`
- Create: `tests/e2e/chat-responsive.spec.ts`
- Create: `tests/e2e/chat-recovery.spec.ts`
- Create: `tests/e2e/chat-visual-accessibility.spec.ts`
- Modify: `playwright.ui-review.config.ts`
- Modify: `docs/ui-ux-review-ci.md`
- Modify: `scripts/summarize-ui-ux-review.mjs`

- [ ] **Step 1: Add deterministic browser fixtures**

Intercept `/api/chat/respond` with NDJSON fixtures for: normal three-option plan, evidence-only answer, long-running stages, partial evidence failure, provider failure before text, provider failure after artifact, map unavailable, stale revision, and rate limit. Do not add production fake switches.

- [ ] **Step 2: Add breakpoint and interaction assertions**

Test 375×844, 768×1024, 1024×768, and 1440×1000. Assert no page overflow; composer is not covered; mobile switcher has at most four destinations; map region and attribution are visible; controls meet 44px; Escape closes drawer and restores focus; tab order follows rail → conversation → artifact tabs → content → inspector; reduced motion removes pane travel.

- [ ] **Step 3: Capture the review workflow**

At each required breakpoint capture chat home, active stream, three-option plan, Map selected with inspector, Evidence selected, fine-tune dirty, revision diff, partial failure, and recovery. Extend diagnostics to report controls below 44px for the chat routes while preserving the current WCAG 24px candidate report for legacy screens.

- [ ] **Step 4: Run automated quality gates**

Run:

```powershell
pnpm test:e2e -- tests/e2e/chat-workspace.spec.ts tests/e2e/chat-responsive.spec.ts tests/e2e/chat-recovery.spec.ts tests/e2e/chat-visual-accessibility.spec.ts
pnpm test:ui-review
```

Expected: all tests pass and artifacts exist for every named state.

- [ ] **Step 5: Perform the human UI/UX review**

Inspect screenshots as a journey. Block deployment for blank/low-value canvas, confusing primary action, same-looking package options, forced selection, map resize/legend failure, jargon, demo/synthetic copy, hidden caveats, unrecoverable errors, inaccessible focus, overflow, clipped text, or nested-scroll traps. Resolve blocking and major findings, recapture, and record only polish deferrals with owner and rationale.

- [ ] **Step 6: Run the full repository gate and commit**

Run:

```powershell
pnpm verify
pnpm test:ui-review
```

Expected: PASS.

```powershell
git add tests/e2e playwright.ui-review.config.ts docs/ui-ux-review-ci.md scripts/summarize-ui-ux-review.mjs
git commit -m "test: gate AI workspace experience quality"
```
