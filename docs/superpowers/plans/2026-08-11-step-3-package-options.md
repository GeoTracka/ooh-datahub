# Step 3 Package Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Step 3 into a three-style package comparison with direct continue and fine-tune paths from the selected baseline.

**Architecture:** Extend the existing optimizer result with three deterministic, unique package options derived from the already-evaluated candidate cohort. Keep `recommended` as the active package contract, add a reducer transition for package preview selection, and render comparison cards above the selected package's existing metrics and zone breakdown.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Vitest, Testing Library, Playwright, CSS.

---

## File structure

- Modify `src/contracts/domain.ts` — package-style and package-option contracts.
- Modify `src/planning/packageOptimizer.ts` — deterministic style rankings and option cohort.
- Modify `src/application/plannerReducer.ts` — package preview selection without fine-tune history.
- Create `src/features/PackageOptionComparison.tsx` — accessible three-option decision surface.
- Modify `src/features/PlannerPage.tsx` — selection, continue, and direct fine-tune orchestration.
- Modify `src/features/StepCard.tsx` — optional secondary footer action.
- Modify `src/features/PackageStrip.tsx` — selected-package heading support.
- Modify `src/features/RecommendationCarousel.tsx` — selected-package zone semantics.
- Create `src/app/package-options.css` and modify `src/app/layout.tsx` — isolated responsive styling.
- Modify focused unit/component/e2e tests and README workflow copy.

### Task 1: Deterministic package-style cohort

**Files:**
- Modify: `src/contracts/domain.ts`
- Modify: `src/planning/packageOptimizer.ts`
- Test: `tests/unit/planning/optimizerProperties.test.ts`

- [ ] **Step 1: Write failing optimizer tests**

Add tests that assert the seeded brief returns three unique styles and that each style obeys its ranking rule:

```ts
it("returns three unique planning styles", () => {
  const result = optimizePackage(frozenLagosBundle, brief);
  expect(result.packageOptions.map((option) => option.style)).toEqual([
    "best_overall",
    "maximum_delivery",
    "budget_smart",
  ]);
  expect(new Set(result.packageOptions.map((option) => option.candidate.id)).size).toBe(3);
  expect(result.packageOptions[0].candidate.id).toBe(result.recommended.id);
});

it("keeps budget smart within five fit points of best overall", () => {
  const result = optimizePackage(frozenLagosBundle, brief);
  const best = result.packageOptions.find((option) => option.style === "best_overall")!;
  const budget = result.packageOptions.find((option) => option.style === "budget_smart")!;
  expect(budget.candidate.planningFit!)
    .toBeGreaterThanOrEqual(best.candidate.planningFit! - 5);
  expect(budget.candidate.costNgn).toBeLessThanOrEqual(best.candidate.costNgn);
});

it.each(["broad_reach", "influential_core", "near_conversion"] as const)(
  "maximizes objective delivery for %s",
  (objective) => {
    const result = optimizePackage(frozenLagosBundle, { ...brief, objective });
    const maximum = result.packageOptions.find(
      (option) => option.style === "maximum_delivery",
    )!;
    expect(maximum.candidate.deliveryRaw).not.toBeNull();
    expect(maximum.candidate.valid).toBe(true);
  },
);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run tests/unit/planning/optimizerProperties.test.ts`

Expected: FAIL because `packageOptions` and its types do not exist.

- [ ] **Step 3: Add the package option contract**

Add to `src/contracts/domain.ts`:

```ts
export type PackageOptionStyle =
  | "best_overall"
  | "maximum_delivery"
  | "budget_smart";

export type PackageOption = {
  style: PackageOptionStyle;
  candidate: PackageCandidate;
};
```

Add `packageOptions: PackageOption[]` to `PlanningResult`.

- [ ] **Step 4: Implement deterministic style selection**

In `packageOptimizer.ts`, add focused helpers:

```ts
function candidateScore(candidate: PackageCandidate): number {
  return candidate.planningFit ?? candidate.contextRankScore ?? -1;
}

function uniqueFirst(
  ranked: PackageCandidate[],
  selectedIds: Set<string>,
): PackageCandidate | null {
  return ranked.find((candidate) => !selectedIds.has(candidate.id)) ?? null;
}

export function selectPackageOptions(
  ranked: PackageCandidate[],
): PackageOption[] {
  const valid = ranked.filter((candidate) => candidate.valid);
  const pool = valid.length >= 3 ? valid : ranked;
  const bestScore = Math.max(...pool.map(candidateScore));
  const rankings: Array<[PackageOptionStyle, PackageCandidate[]]> = [
    ["best_overall", [...pool].sort(comparePackageCandidates)],
    ["maximum_delivery", [...pool].sort((left, right) =>
      ((right.deliveryRaw ?? -1) - (left.deliveryRaw ?? -1)) ||
      comparePackageCandidates(left, right)
    )],
    ["budget_smart", [...pool]
      .filter((candidate) => candidateScore(candidate) >= bestScore - 5)
      .sort((left, right) =>
        left.costNgn - right.costNgn || comparePackageCandidates(left, right)
      )],
  ];
  const selectedIds = new Set<string>();
  return rankings.flatMap(([style, candidates]) => {
    const candidate = uniqueFirst(candidates, selectedIds) ?? uniqueFirst(pool, selectedIds);
    if (!candidate) return [];
    selectedIds.add(candidate.id);
    return [{ style, candidate }];
  });
}
```

Return `packageOptions: selectPackageOptions(ranked)` from `optimizePackage`. Keep `recommended` and `internalReplacements` unchanged.

- [ ] **Step 5: Run focused optimizer tests and verify GREEN**

Run: `pnpm vitest run tests/unit/planning/optimizerProperties.test.ts`

Expected: all optimizer property tests pass.

- [ ] **Step 6: Commit the optimizer contract**

```bash
git add src/contracts/domain.ts src/planning/packageOptimizer.ts tests/unit/planning/optimizerProperties.test.ts
git commit -m "feat: derive distinct package recommendation styles"
```

### Task 2: Package preview lifecycle

**Files:**
- Modify: `src/application/plannerReducer.ts`
- Test: `tests/unit/application/plannerReducer.test.ts`

- [ ] **Step 1: Write reducer tests for package preview**

```ts
it("previews a package without adding fine-tune history", () => {
  const applied = buildPlan(frozenLagosBundle, brief);
  const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
  const alternative = applied.packageOptions[1].candidate;
  const preview = recalculateSelectedSites(
    frozenLagosBundle,
    applied,
    alternative.siteIds,
  );
  const selected = plannerReducer(loaded, { type: "package-previewed", plan: preview });
  expect(selected.draftPlan?.recommended.id).toBe(alternative.id);
  expect(selected.draftHistory).toEqual([]);
  expect(selected.lastAction).toBe("Package option selected");
});

it("clears an alternative preview when original package is selected", () => {
  const applied = buildPlan(frozenLagosBundle, brief);
  const dirty = {
    ...plannerReducer(initialPlannerState, { type: "loaded", plan: applied }),
    draftPlan: recalculateSelectedSites(
      frozenLagosBundle,
      applied,
      applied.packageOptions[1].candidate.siteIds,
    ),
    status: "dirty" as const,
  };
  const cleared = plannerReducer(dirty, { type: "package-previewed", plan: null });
  expect(cleared.draftPlan).toBeNull();
  expect(cleared.status).toBe("loaded");
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `pnpm vitest run tests/unit/application/plannerReducer.test.ts`

Expected: FAIL because `package-previewed` is not a valid action.

- [ ] **Step 3: Add the package-previewed transition**

Add to `PlannerAction`:

```ts
| { type: "package-previewed"; plan: PlanningResult | null }
```

Add to the reducer before `drafted`:

```ts
case "package-previewed":
  return {
    ...state,
    draftPlan: action.plan,
    draftHistory: [],
    lastAction: action.plan ? "Package option selected" : null,
    status: action.plan ? "dirty" : "loaded",
  };
```

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run: `pnpm vitest run tests/unit/application/plannerReducer.test.ts`

Expected: all reducer and planner-service tests pass.

- [ ] **Step 5: Commit the lifecycle change**

```bash
git add src/application/plannerReducer.ts tests/unit/application/plannerReducer.test.ts
git commit -m "feat: add package option preview lifecycle"
```

### Task 3: Accessible package comparison component

**Files:**
- Create: `src/features/PackageOptionComparison.tsx`
- Test: `tests/component/ExplorerComponents.test.tsx`

- [ ] **Step 1: Write the failing component test**

Render the component from `buildPlan(frozenLagosBundle, brief)` and assert:

```ts
expect(screen.getByRole("radiogroup", { name: "Planning approaches" }))
  .toBeInTheDocument();
expect(screen.getAllByRole("radio")).toHaveLength(3);
expect(screen.getByRole("radio", { name: /Best overall/ })).toBeChecked();
expect(screen.getByText("Maximum delivery")).toBeInTheDocument();
expect(screen.getByText("Budget smart")).toBeInTheDocument();
await userEvent.click(screen.getByRole("radio", { name: /Budget smart/ }));
expect(onSelect).toHaveBeenCalledWith(plan.packageOptions[2].candidate);
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `pnpm vitest run tests/component/ExplorerComponents.test.tsx`

Expected: FAIL because `PackageOptionComparison` does not exist.

- [ ] **Step 3: Implement the comparison component**

Create a component with props:

```ts
type Props = {
  plan: PlanningResult;
  selectedPackageId: string;
  onSelect(candidate: PackageCandidate): void;
};
```

Use a labelled `role="radiogroup"`; each option is a native `<input type="radio">` inside a card label. Map style copy as:

```ts
const styleCopy = {
  best_overall: { label: "Best overall", description: "Strongest balance for this brief" },
  maximum_delivery: { label: "Maximum delivery", description: "Prioritizes the campaign objective" },
  budget_smart: { label: "Budget smart", description: "Preserves fit while creating headroom" },
} as const;
```

Render site/zone counts, objective delivery, cost/headroom, and planning fit. Use `Unavailable` for null delivery or fit and never coerce it to zero.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `pnpm vitest run tests/component/ExplorerComponents.test.tsx`

Expected: component tests pass with three accessible package choices.

- [ ] **Step 5: Commit the comparison component**

```bash
git add src/features/PackageOptionComparison.tsx tests/component/ExplorerComponents.test.tsx
git commit -m "feat: add accessible package option comparison"
```

### Task 4: Step 3 two-path orchestration

**Files:**
- Modify: `src/features/PlannerPage.tsx`
- Modify: `src/features/StepCard.tsx`
- Modify: `src/features/PackageStrip.tsx`
- Modify: `src/features/RecommendationCarousel.tsx`
- Test: `tests/component/PlannerPage.test.tsx`
- Test: `tests/component/ExplorerInvalidPackage.test.tsx`
- Test: `tests/component/ExplorerSemanticUx.test.tsx`

- [ ] **Step 1: Replace the acceptance-flow tests with selection and direct fine-tune tests**

Assert Step 3 is named `Choose a planning approach`, renders three radios, and exposes both buttons. Add one test that selects Budget smart, clicks Continue, and reaches Step 4. Add another that selects Maximum delivery, clicks Fine-tune, and reaches Step 5 without visiting Step 4.

- [ ] **Step 2: Run focused page tests and verify RED**

Run: `pnpm vitest run tests/component/PlannerPage.test.tsx tests/component/ExplorerInvalidPackage.test.tsx tests/component/ExplorerSemanticUx.test.tsx`

Expected: FAIL because Step 3 still has one package and one acceptance action.

- [ ] **Step 3: Add an optional secondary StepCard action**

Extend `StepCard` with:

```ts
secondaryAction?: {
  label: string;
  onClick(): void;
  disabled?: boolean;
};
```

Render primary and secondary actions in `.explorer-step-action-group`, keeping Back separate. Secondary remains enabled for invalid package repair.

- [ ] **Step 4: Wire package selection in PlannerPage**

Add handlers with the applied plan as the stable comparison basis:

```ts
function selectPackage(candidate: PackageCandidate) {
  const basis = state.appliedPlan;
  if (!basis) return;
  setSelectedZoneId(null);
  if (candidate.id === basis.recommended.id) {
    dispatch({ type: "package-previewed", plan: null });
    return;
  }
  dispatch({
    type: "package-previewed",
    plan: recalculateSelectedSites(bundle, basis, candidate.siteIds),
  });
}

function continueWithPackage() {
  if (state.draftPlan) dispatch({ type: "applied" });
  setStep(4);
}
```

Use `PackageOptionComparison` before the selected-package zone breakdown. Configure actions:

```tsx
primaryAction={{
  label: "Continue with selected package",
  onClick: continueWithPackage,
  disabled: !visible.recommended.valid,
}}
secondaryAction={{
  label: "Fine-tune selected package",
  onClick: () => setStep(5),
}}
```

- [ ] **Step 5: Clarify selected-package copy**

Add a `heading` prop to `PackageStrip`, pass `heading="Selected package"` on Step 3, and change the zone group label to `Selected package zones`. Replace `View full package` with `Clear zone focus` so the link describes its actual effect.

- [ ] **Step 6: Run focused page tests and verify GREEN**

Run: `pnpm vitest run tests/component/PlannerPage.test.tsx tests/component/ExplorerInvalidPackage.test.tsx tests/component/ExplorerSemanticUx.test.tsx tests/component/ExplorerComponents.test.tsx`

Expected: all focused Step 3 tests pass.

- [ ] **Step 7: Commit the integrated flow**

```bash
git add src/features/PlannerPage.tsx src/features/StepCard.tsx src/features/PackageStrip.tsx src/features/RecommendationCarousel.tsx tests/component
git commit -m "feat: offer continue and fine-tune paths in Step 3"
```

### Task 5: Responsive visual hierarchy

**Files:**
- Create: `src/app/package-options.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/explorer-polish.css`
- Test: `tests/e2e/visual-accessibility.spec.ts`
- Test: `tests/e2e/ui-quality-hierarchy.spec.ts`

- [ ] **Step 1: Add failing e2e expectations for the comparison surface**

Assert the three option cards are visible in the Step 3 viewport, the selected option has a text/state indicator, and both actions are reachable. Retain the existing axe scan.

- [ ] **Step 2: Run the targeted browser test and verify RED**

Run: `pnpm exec playwright test tests/e2e/ui-quality-hierarchy.spec.ts --grep "Step 3"`

Expected: FAIL because the package option layout does not exist.

- [ ] **Step 3: Implement isolated package-option styling**

Create `package-options.css` with three equal desktop columns, stacked narrow cards, visible radio focus, non-color selected state, compact metric rows, and an action group that keeps both actions visible. Import it after `explorer-polish.css` in `layout.tsx`. Remove obsolete absolute-position Step 3 detail rules from `explorer-polish.css` that would conflict with the new normal-flow layout.

- [ ] **Step 4: Run the targeted browser test and verify GREEN**

Run: `pnpm exec playwright test tests/e2e/ui-quality-hierarchy.spec.ts --grep "Step 3"`

Expected: Step 3 hierarchy and accessibility checks pass.

- [ ] **Step 5: Refresh intentional visual baselines**

Run: `pnpm exec playwright test tests/e2e/visual-accessibility.spec.ts --update-snapshots`

Inspect desktop, focused Step 3, and mobile snapshots before accepting them.

- [ ] **Step 6: Commit styling and baselines**

```bash
git add src/app/package-options.css src/app/layout.tsx src/app/explorer-polish.css tests/e2e
git commit -m "style: clarify Step 3 package comparison"
```

### Task 6: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: affected e2e specs containing `This package works` or `Recommended package`

- [ ] **Step 1: Update workflow language and selectors**

Change README Step 3 to describe three planning approaches and direct fine-tuning. Update e2e selectors to `Choose a planning approach`, `Continue with selected package`, and `Fine-tune selected package` without weakening assertions.

- [ ] **Step 2: Run all unit and component tests**

Run: `pnpm test`

Expected: all Vitest suites pass with zero failures.

- [ ] **Step 3: Run deterministic and static verification**

Run: `pnpm lint && pnpm typecheck && pnpm db:check && pnpm bundle:verify && pnpm golden:check && pnpm verify:secrets`

Expected: every command exits zero; checked-in generated artifacts remain unchanged unless the package contract intentionally requires a reviewed update.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: Next.js production compilation, TypeScript, page generation, and route summary complete successfully.

- [ ] **Step 5: Run focused end-to-end flows**

Run: `pnpm exec playwright test tests/e2e/seeded-fmcg.spec.ts tests/e2e/fine-tune-workspace.spec.ts tests/e2e/visual-accessibility.spec.ts`

Expected: package selection, direct fine-tune, and visual/accessibility flows pass.

- [ ] **Step 6: Commit documentation and selector migrations**

```bash
git add README.md tests/e2e
git commit -m "docs: describe package approach selection"
```
