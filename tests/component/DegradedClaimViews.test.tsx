import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MetricClaimSchema,
  type MetricClaim,
} from "@/contracts/metrics";
import { selectPermittedDeliveryView } from "@/application/permittedDeliveryView";

function metric(input: Record<string, unknown>): MetricClaim {
  return MetricClaimSchema.parse({
    id: String(input.kind),
    label: String(input.label),
    sourceIds: ["fixture-source"],
    caveats: ["Fixture caveat"],
    applicability: "inside",
    ...input,
  });
}

type ViewCase = {
  name: string;
  claim: MetricClaim;
  recoveryAction: string | null;
  expectedValue: string;
  expectedUnit: string;
  expectedEvidence: string;
  expectedState: string;
};

const cases: ViewCase[] = [
  {
    name: "Activity Potential",
    claim: metric({
      kind: "activity_potential", label: "Activity Potential", state: "modelled",
      evidence: "D", unit: "index_0_100", value: 72,
    }),
    recoveryAction: null,
    expectedValue: "72",
    expectedUnit: "index_0_100",
    expectedEvidence: "Evidence D",
    expectedState: "modelled",
  },
  {
    name: "movement",
    claim: metric({
      kind: "movement", label: "Person passages", state: "observed",
      evidence: "C", unit: "person_passages", value: 180_000,
    }),
    recoveryAction: "Verify face orientation and delivery schedule",
    expectedValue: "180K",
    expectedUnit: "person_passages",
    expectedEvidence: "Evidence C",
    expectedState: "observed",
  },
  {
    name: "general OTS",
    claim: metric({
      kind: "general_ots", label: "General OTS", state: "modelled",
      evidence: "C", unit: "ots", value: 95_000,
    }),
    recoveryAction: "Attach a compatible target allocation source",
    expectedValue: "95K",
    expectedUnit: "ots",
    expectedEvidence: "Evidence C",
    expectedState: "modelled",
  },
  {
    name: "target OTS",
    claim: metric({
      kind: "target_ots", label: "Target OTS", state: "assumed",
      evidence: "D", unit: "ots", value: 56_000,
    }),
    recoveryAction: "Attach an eligible overlap model",
    expectedValue: "56K",
    expectedUnit: "ots",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "scenario reach",
    claim: metric({
      kind: "scenario_target_reach", label: "Scenario target reach", state: "assumed",
      evidence: "D", unit: "people", universe: 800_000,
      range: { type: "scenario", low: 220_000, base: 250_000, high: 285_000 },
    }),
    recoveryAction: null,
    expectedValue: "220K / 250K / 285K",
    expectedUnit: "people · Low / Base / High scenario",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "calibrated reach",
    claim: metric({
      kind: "calibrated_target_reach", label: "Calibrated target reach", state: "modelled",
      evidence: "C", unit: "people", universe: 800_000,
      range: { type: "quantile", p10: 210_000, p50: 248_000, p90: 291_000 },
    }),
    recoveryAction: null,
    expectedValue: "210K / 248K / 291K",
    expectedUnit: "people · P10 / P50 / P90",
    expectedEvidence: "Evidence C",
    expectedState: "modelled",
  },
  {
    name: "scenario Influence",
    claim: metric({
      kind: "influence_capture", label: "Influence Capture", state: "assumed",
      evidence: "D", unit: "percent", qiSourceId: "fixture-qi",
      range: { type: "scenario", low: 40, base: 45, high: 51 },
    }),
    recoveryAction: null,
    expectedValue: "40% / 45% / 51%",
    expectedUnit: "percent · Low / Base / High scenario",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "no-qi Influence",
    claim: metric({
      kind: "unavailable", label: "Influence Capture", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "QI_UNAVAILABLE",
      caveats: ["A named category-specific influence source is required"],
      applicability: "outside",
    }),
    recoveryAction: "Attach a named category-specific influence propensity source",
    expectedValue: "Unavailable",
    expectedUnit: "none",
    expectedEvidence: "Evidence unavailable",
    expectedState: "unavailable",
  },
  {
    name: "context only",
    claim: metric({
      kind: "unavailable", label: "Context shortlist", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "LOW_PRECISION_GEOCODE",
      caveats: ["Context only: coordinate needs review"], applicability: "outside",
    }),
    recoveryAction: "Supply an independently sourced precise coordinate",
    expectedValue: "Unavailable",
    expectedUnit: "none",
    expectedEvidence: "Evidence unavailable",
    expectedState: "unavailable",
  },
];

function ClaimView({ value }: { value: ViewCase }) {
  const view = selectPermittedDeliveryView(value.claim, value.recoveryAction);
  return (
    <section aria-label={view.label}>
      <h2>{view.label}</h2>
      <output data-testid="value">{view.valueText}</output>
      <span data-testid="unit">{view.unitLabel}</span>
      <span data-testid="evidence">{view.evidenceLabel}</span>
      <span data-testid="state">{view.stateLabel}</span>
      <ul>{view.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
      <p data-testid="recovery">{view.recoveryAction ?? "No recovery needed"}</p>
    </section>
  );
}

describe("claim-aware visual copy", () => {
  it.each(cases)("renders only the permitted $name claim", (viewCase) => {
    render(<ClaimView value={viewCase} />);
    expect(screen.getByRole("heading", { name: viewCase.claim.label })).toBeVisible();
    expect(screen.getByTestId("value")).toHaveTextContent(viewCase.expectedValue);
    expect(screen.getByTestId("unit")).toHaveTextContent(viewCase.expectedUnit);
    expect(screen.getByTestId("evidence")).toHaveTextContent(viewCase.expectedEvidence);
    expect(screen.getByTestId("state")).toHaveTextContent(viewCase.expectedState);
    for (const caveat of viewCase.claim.caveats) {
      expect(screen.getByText(caveat)).toBeVisible();
    }
    expect(screen.getByTestId("recovery")).toHaveTextContent(
      viewCase.recoveryAction ?? "No recovery needed",
    );
  });
});
