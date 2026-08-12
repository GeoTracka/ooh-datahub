import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

describe("explorer invalid package guard", () => {
  it("blocks package acceptance while leading with a recoverable explanation", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue to timing" }));
    const budget = screen.getByLabelText("Budget (NGN)");
    await userEvent.clear(budget);
    await userEvent.type(budget, "1");
    await userEvent.click(screen.getByRole("button", { name: "Show recommended areas" }));

    const alert = await screen.findByRole("alert", { name: "Package issues" });
    expect(alert).toHaveTextContent("This package is over the campaign budget");
    expect(alert).toHaveTextContent("Increase the budget or replace a location");
    expect(alert.querySelector(".recovery-notice-copy")).not.toHaveTextContent(
      "BUDGET_EXCEEDED",
    );
    expect(alert.querySelector("details")).toHaveTextContent("BUDGET_EXCEEDED");
    expect(screen.getByRole("button", { name: "Continue with selected package" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "Adjust selected package" }))
      .toBeEnabled();
  }, 30000);
});
