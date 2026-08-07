import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

describe("PlannerPage explorer", () => {
  it("starts with one campaign-profile decision surface", () => {
    render(<PlannerPage />);
    expect(screen.getByRole("region", { name: /Step 1 of 5: Who is this campaign for/ }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Product name")).toBeInTheDocument();
    expect(screen.queryByTestId("zone-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("package-strip")).not.toBeInTheDocument();
  });

  it("supports the default timing skip and shows one three-zone package", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    expect(screen.getByRole("region", { name: /Step 3 of 5: Recommended package/ }))
      .toBeInTheDocument();
    expect(screen.getAllByTestId("zone-card")).toHaveLength(3);
    expect(screen.getAllByTestId("package-strip")).toHaveLength(1);
    expect(screen.getByText(/Scenario target reach/)).toBeInTheDocument();
    for (const name of ["Plan", "Activity", "Reach", "Influence"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  }, 30000);

  it("focuses a recommendation before opening its delivery story", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    const zoneCards = screen.getAllByTestId("zone-card");
    await userEvent.click(zoneCards[1].querySelector("button")!);
    expect(screen.getByRole("button", { name: "View delivery story" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "How delivery was estimated" }))
      .not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View delivery story" }));
    expect(screen.getByRole("dialog", { name: "How delivery was estimated" }))
      .toBeInTheDocument();
  }, 30000);

  it("routes package acceptance into outcomes and fine-tune", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await userEvent.click(screen.getByRole("button", { name: "This package works" }));
    expect(screen.getByRole("region", { name: /Step 4 of 5:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fine-tune package/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Fine-tune package/ }));
    expect(screen.getByRole("region", { name: /Step 5 of 5: Make this package yours/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Plan adjustments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review RFQ" })).toBeEnabled();
  }, 30000);
});
