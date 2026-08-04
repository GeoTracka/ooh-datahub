import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

describe("PlannerPage", () => {
  it("shows three zone cards and one compact package strip", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    expect(screen.getAllByTestId("zone-card")).toHaveLength(3);
    expect(screen.getAllByTestId("package-strip")).toHaveLength(1);
    expect(screen.getByText(/Scenario target reach/)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence D/).length).toBeGreaterThan(0);
  }, 30000);

  it("keeps all four lenses visible and explains an unavailable lens", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    for (const name of ["Plan", "Activity", "Reach", "Influence"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  }, 30000);

  it("changes card delivery copy when the objective changes", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    expect(screen.getAllByText(/Marginal target reach/)).toHaveLength(3);
    await userEvent.selectOptions(
      screen.getByLabelText("Objective"),
      "influential_core",
    );
    expect(screen.getAllByText(/Marginal influence/)).toHaveLength(3);
    expect(screen.getByText("Unapplied changes")).toBeInTheDocument();
    const changes = screen.getByRole("region", { name: "What changed" });
    await userEvent.click(within(changes).getByText("Compare with original recommendation"));
    expect(within(changes).getAllByText(/Not comparable/)).toHaveLength(2);
    expect(within(changes).getAllByText(/Low \/ Base \/ High/)).toHaveLength(4);
    expect(within(changes).getAllByText(/Planning Fit/).length).toBeGreaterThan(0);
    expect(within(changes).getAllByText(/Evidence/).length).toBeGreaterThan(0);
    expect(within(changes).getAllByText(/Affected pillars/)).toHaveLength(2);
    expect(within(changes).getAllByText(/Action:/)).toHaveLength(2);
    expect(within(changes).getAllByText("Calculation basis")).toHaveLength(4);
  }, 30000);

  it("keeps a below-minimum budget repairable and blocks RFQ review", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    const budget = screen.getByLabelText("Budget (NGN)");
    await userEvent.clear(budget);
    await userEvent.type(budget, "1");
    expect(screen.getByText("BUDGET_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply & review RFQ" })).toBeDisabled();
  }, 30000);
});
