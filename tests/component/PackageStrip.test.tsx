import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import { PackageStrip } from "@/features/PackageStrip";

const plan = buildPlan(bundle, {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
});

describe("PackageStrip", () => {
  it("renders the recommended package info and RFQ button", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    expect(screen.getByTestId("package-strip")).toBeInTheDocument();
    expect(screen.getByText(/Recommended package/)).toBeInTheDocument();
    expect(screen.getByText(/sites ·/)).toBeInTheDocument();
  });

  it("enables the Review RFQ button when canReviewRfq is true", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Review RFQ" });
    expect(button).toBeEnabled();
  });

  it("disables the Review RFQ button when canReviewRfq is false", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={false}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Review RFQ" });
    expect(button).toBeDisabled();
  });

  it("shows Apply & review RFQ label when isDirty is true", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={true}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply & review RFQ" })).toBeInTheDocument();
  });

  it("renders delivery labels and evidence scores", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    expect(screen.getByText(/Scenario target reach/)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence D/).length).toBeGreaterThan(0);
  });
});
