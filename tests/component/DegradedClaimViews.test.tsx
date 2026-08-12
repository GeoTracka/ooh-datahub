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
    name: "area activity",
    claim: metric({
      kind: "activity_potential", label: "Area activity", state: "modelled",
      evidence: "D", unit: "index_0_100", value: 72,
    }),
    recoveryAction: null,
    expectedValue: "72",
    expectedUnit: "score out of 100",
    expectedEvidence: "Early estimate",
    expectedState: "Calculated estimate",
  },
  {
    name: "movement",
    claim: metric({
      kind: "movement", label: "Person passages", state: "observed",
      evidence: "C", unit: "person_passages", value: 180_000,
    }),
    recoveryAction: "Check the media location's viewing direction and campaign schedule",
    expectedValue: "180K",
    expectedUnit: "people passing",
    expectedEvidence: "Moderate confidence",
    expectedState: "Planning estimate",
  },
  {
    name: "general OTS",
    claim: metric({
      kind: "general_ots", label: "Possible ad views", state: "modelled",
      evidence: "C", unit: "ots", value: 95_000,
    }),
    recoveryAction: "Add audience information for this campaign",
    expectedValue: "95K",
    expectedUnit: "possible ad views",
    expectedEvidence: "Moderate confidence",
    expectedState: "Calculated estimate",
  },
  {
    name: "target OTS",
    claim: metric({
      kind: "target_ots", label: "Relevant audience ad views", state: "assumed",
      evidence: "D", unit: "ots", value: 56_000,
    }),
    recoveryAction: "Add audience-overlap information",
    expectedValue: "56K",
    expectedUnit: "possible ad views",
    expectedEvidence: "Early estimate",
    expectedState: "Planning estimate",
  },
  {
    name: "scenario reach",
    claim: metric({
      kind: "scenario_target_reach", label: "Estimated audience reach", state: "assumed",
      evidence: "D", unit: "people", universe: 800_000,
      range: { type: "scenario", low: 220_000, base: 250_000, high: 285_000 },
    }),
    recoveryAction: null,
    expectedValue: "220K / 250K / 285K",
    expectedUnit: "people · Lower / Expected / Upper",
    expectedEvidence: "Early estimate",
    expectedState: "Planning estimate",
  },
  {
    name: "calibrated reach",
    claim: metric({
      kind: "calibrated_target_reach", label: "Estimated audience reach", state: "modelled",
      evidence: "C", unit: "people", universe: 800_000,
      range: { type: "quantile", p10: 210_000, p50: 248_000, p90: 291_000 },
    }),
    recoveryAction: null,
    expectedValue: "210K / 248K / 291K",
    expectedUnit: "people · Lower / Expected / Upper",
    expectedEvidence: "Moderate confidence",
    expectedState: "Calculated estimate",
  },
  {
    name: "scenario Influence",
    claim: metric({
      kind: "influence_capture", label: "Priority-audience coverage", state: "assumed",
      evidence: "D", unit: "percent", qiSourceId: "fixture-qi",
      range: { type: "scenario", low: 40, base: 45, high: 51 },
    }),
    recoveryAction: null,
    expectedValue: "40% / 45% / 51%",
    expectedUnit: "percent · Lower / Expected / Upper",
    expectedEvidence: "Early estimate",
    expectedState: "Planning estimate",
  },
  {
    name: "no-qi Influence",
    claim: metric({
      kind: "unavailable", label: "Priority-audience coverage", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "QI_UNAVAILABLE",
      caveats: ["A named category-specific influence source is required"],
      applicability: "outside",
    }),
    recoveryAction: "Attach a named category-specific influence propensity source",
    expectedValue: "Unavailable",
    expectedUnit: "No estimate",
    expectedEvidence: "Data confidence unavailable",
    expectedState: "Unavailable",
  },
  {
    name: "context only",
    claim: metric({
      kind: "unavailable", label: "Inventory shortlist", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "LOW_PRECISION_GEOCODE",
      caveats: ["Context only: coordinate needs review"], applicability: "outside",
    }),
    recoveryAction: "Supply an independently sourced precise coordinate",
    expectedValue: "Unavailable",
    expectedUnit: "No estimate",
    expectedEvidence: "Data confidence unavailable",
    expectedState: "Unavailable",
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
