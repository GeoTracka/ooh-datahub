# Step 3 Map Split-Pane Design

## Problem

Step 3 expands the recommendation rail to approximately 1,000 pixels on a 1,440-pixel desktop, while the map remains positioned across the full viewport. MapLibre therefore centers its useful geometry behind the rail, leaving the visible right side narrow and visually empty. The lens controls and legend appear detached from the data they describe.

## Decision

Use a true desktop split pane for Step 3.

- Clamp the Step 3 rail to `720px–800px`, targeting about 52% of the viewport.
- Start the map stage at the rail's right edge so MapLibre measures and centers itself within the visible map pane.
- Keep the lens tabs, legend, and planning-context note inside the map pane.
- Preserve the current stacked layout below `1024px`.
- Do not change package selection, map data, lens behavior, or mobile interactions.

## Alternatives Considered

1. Camera offset only: rejected because controls and hit-testing would still belong to a map hidden behind the rail.
2. Collapsible map drawer: rejected because it adds a new interaction and hides useful planning context.
3. True split pane: selected because it fixes geometry, visibility, interaction, and hierarchy with one layout rule.

## Acceptance Criteria

- At `1440px`, the Step 3 rail is no wider than `800px` and the map retains at least `600px`.
- The map stage begins at or after the rail's right edge.
- The selected map marker, lens tabs, legend, and planning note are visible inside the map pane.
- At `1024px`, all three package approaches and both Step 3 actions remain operable without horizontal overflow.
- Existing tablet and mobile layouts remain unchanged.
- Accessibility checks and the full browser suite pass.

## Verification

Add a desktop Playwright regression test for pane geometry and marker visibility, then run focused browser tests, the full unit/browser suites, type checking, linting, and a production build. Capture and inspect Step 3 at `1440×900` and `1024×768` before deployment.
