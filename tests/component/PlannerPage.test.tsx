import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: ({ selectedFeatureId }: { selectedFeatureId?: string | null }) => (
    <div
      data-testid="map-canvas"
      data-camera-selection={selectedFeatureId ?? "package-overview"}
    />
  ),
}));

afterEach(() => vi.unstubAllGlobals());

describe("PlannerPage explorer", () => {
  it("starts with one campaign-profile decision surface", () => {
    render(<PlannerPage />);
    expect(screen.getByRole("region", { name: /Step 1 of 5: Who is this campaign for/ }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Product name")).toBeInTheDocument();
    expect(screen.queryByTestId("zone-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("package-strip")).not.toBeInTheDocument();
  });

  it("paints a recommendation working state and locks conflicting controls", async () => {
    let pendingFrame: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 1;
    }));
    render(<PlannerPage />);

    const skip = screen.getByRole("button", { name: "Use default timing & budget" });
    await userEvent.click(skip);

    expect(screen.getByRole("status", { name: "Building your recommendation…" }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Step 1 of 5:/ })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Building your recommendation…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue to timing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Consumer goods · Broad reach" })).toBeDisabled();
    expect(screen.getByLabelText("Product name")).toBeDisabled();
    expect(pendingFrame).not.toBeNull();

    await act(async () => {
      pendingFrame?.(0);
      await Promise.resolve();
    });
    expect(await screen.findByRole("region", { name: /Step 3 of 5: Choose a planning approach/ }))
      .toBeInTheDocument();
  }, 30000);

  it("supports the default timing skip and compares three package approaches", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    expect(await screen.findByRole("region", { name: /Step 3 of 5: Choose a planning approach/ }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Best overall/ })).toBeChecked();
    expect(screen.getAllByTestId("zone-card")).toHaveLength(3);
    expect(screen.getAllByTestId("package-strip")).toHaveLength(1);
    expect(screen.getAllByText(/Estimated audience reach/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Early estimate").length).toBeGreaterThan(0);
    for (const name of ["Plan", "Area activity", "Reach", "Priority audience"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  }, 30000);

  it("focuses a recommendation before opening its delivery story", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    const zoneCards = await screen.findAllByTestId("zone-card");
    await userEvent.click(zoneCards[1].querySelector("button")!);
    expect(screen.getByRole("button", { name: "See how this was estimated" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "How the estimate was built" }))
      .not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See how this was estimated" }));
    expect(screen.getByRole("dialog", { name: "How the estimate was built" }))
      .toBeInTheDocument();
  }, 30000);

  it("continues with a selected package and keeps fine-tune available", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await screen.findByRole("region", { name: /Step 3 of 5:/ });
    await userEvent.click(screen.getByRole("radio", { name: /Budget smart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue with selected package" }));
    expect(screen.getByRole("region", { name: /Step 4 of 5:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adjust package/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Adjust package/ }));
    expect(screen.getByRole("region", { name: /Step 5 of 5: Make this package yours/ }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Package adjustments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review supplier request" })).toBeEnabled();
  }, 30000);

  it("opens Step 3 on the complete package and restores overview when the package changes", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await screen.findByRole("region", { name: /Step 3 of 5:/ });

    expect(screen.getByTestId("map-canvas"))
      .toHaveAttribute("data-camera-selection", "package-overview");

    const zoneCards = screen.getAllByTestId("zone-card");
    await userEvent.click(zoneCards[1].querySelector("button")!);
    expect(screen.getByTestId("map-canvas"))
      .not.toHaveAttribute("data-camera-selection", "package-overview");

    await userEvent.click(screen.getByRole("radio", { name: /Budget smart/ }));
    expect(screen.getByTestId("map-canvas"))
      .toHaveAttribute("data-camera-selection", "package-overview");
  }, 30000);

  it("fine-tunes a selected recommendation directly from Step 3", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await screen.findByRole("region", { name: /Step 3 of 5:/ });
    await userEvent.click(screen.getByRole("radio", { name: /Maximum delivery/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adjust selected package" }));
    expect(screen.getByRole("region", { name: /Step 5 of 5: Make this package yours/ }))
      .toBeInTheDocument();
    expect(screen.getByText("Changes not yet applied")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("region", { name: /Step 3 of 5:/ })).toBeInTheDocument();
  }, 30000);

  it("clears a clean package preview when the applied recommendation is reselected", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await screen.findByRole("region", { name: /Step 3 of 5:/ });
    await userEvent.click(screen.getByRole("radio", { name: /Maximum delivery/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Best overall/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adjust selected package" }));

    expect(screen.queryByText("Changes not yet applied")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review supplier request" })).toBeEnabled();
  }, 30000);
});
