import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import { PackageStrip } from "@/features/PackageStrip";

const plan = buildPlan(bundle, {
  productName: "Spark Refresh",
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
  it("renders the recommended package info and supplier-request button", () => {
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
    expect(screen.getByText(/media locations ·/)).toBeInTheDocument();
  });

  it("enables the supplier-request button when canReviewRfq is true", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Review supplier request" });
    expect(button).toBeEnabled();
  });

  it("disables the supplier-request button when canReviewRfq is false", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={false}
        canReviewRfq={false}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Review supplier request" });
    expect(button).toBeDisabled();
  });

  it("shows the apply-and-review label when isDirty is true", () => {
    render(
      <PackageStrip
        plan={plan}
        isDirty={true}
        canReviewRfq={true}
        onExplain={() => undefined}
        onReviewRfq={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply & review supplier request" })).toBeInTheDocument();
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
    expect(screen.getByText(/Estimated audience reach/)).toBeInTheDocument();
    expect(screen.getAllByText(/Early estimate/).length).toBeGreaterThan(0);
  });
});
