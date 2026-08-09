# Extractable design components

These are design-system candidates grounded in repeated current behavior. Extraction should happen only when it reduces duplication without hiding domain semantics.

## Strong candidates

### EvidenceBadge
Inputs:
- evidence: C | D | unavailable
- optional score
- optional compact mode

Rules:
- always include text, never color only;
- C = teal, D = gold, unavailable = neutral;
- badge must not imply statistical confidence beyond the evidence contract.

### MetricSummary
For compact decision metrics such as spend, delivery, Planning Fit and evidence delta.

Inputs:
- label
- primary value
- optional supporting text/state

Do not use for heterogeneous audit metadata.

### DecisionCard
Large action used in ActionDock and possibly upload path choices.

Anatomy:
- clear action title;
- one sentence consequence;
- optional directional indicator;
- disabled explanation supplied outside or within card when needed.

### ReviewSection
Shared visual grouping for RFQ, upload and other modal workflows.

Anatomy:
- section heading;
- optional helper copy;
- fields/controls;
- optional local error/status.

### AuditDisclosure
Shared `<details>` treatment for technical metadata.

Use for:
- fingerprints;
- comparability keys;
- source IDs;
- preflight JSON;
- data revisions;
- raw generated/plain-text payloads;
- provenance/model-use fields.

Audit disclosure must never hide information required to make the immediate business decision.

### StepIndicator
Numbered small circle + heading used by guided secondary flows such as Upload.

### MapLegend
Compact active-lens explanation:
- metric label;
- evidence state;
- marker encoding note.

## Components to keep domain-specific

- `PackageStrip`: too much Evidence-D/planner semantics to reduce to a generic metric card.
- `CausalDrawer`: navigation/evidence boundary is domain-specific.
- `AdjustmentsPanel`: deterministic plan-choice logic belongs with the planner UI.
- `RfqDrawer`: supplier isolation and draft-status rules are domain-specific.
- `UploadDialog`: parsing/enrichment/evidence boundaries are domain-specific.

## Avoid extracting

- generic `Card`, `Panel`, `Box` wrappers that only move CSS names around;
- icon-only buttons where text is clearer;
- chart wrappers—the current product does not need a charting system;
- generic AI assistant/chat components;
- dashboard navigation before persistent saved-product objects exist.
