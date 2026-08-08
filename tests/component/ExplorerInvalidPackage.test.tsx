import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

describe("explorer invalid package guard", () => {
  it("blocks package acceptance while keeping the invalid reason visible", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue to timing" }));
    const budget = screen.getByLabelText("Budget (NGN)");
    await userEvent.clear(budget);
    await userEvent.type(budget, "1");
    await userEvent.click(screen.getByRole("button", { name: "Show recommended zones" }));

    expect(screen.getByRole("alert", { name: "Package constraints" }))
      .toHaveTextContent("BUDGET_EXCEEDED");
    expect(screen.getByRole("button", { name: "This package works" })).toBeDisabled();
  }, 30000);
});
