import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MapLens } from "@/contracts/renderer";
import { LensTabs } from "@/features/LensTabs";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";

function LensHarness({
  influenceAvailable = true,
  initialLens = "plan",
}: {
  influenceAvailable?: boolean;
  initialLens?: MapLens;
}) {
  const [lens, setLens] = useState<MapLens>(initialLens);
  return (
    <>
      <output aria-label="Current map view">{lens}</output>
      <LensTabs active={lens} onChange={setLens} influenceAvailable={influenceAvailable} />
    </>
  );
}

describe("keyboard accessibility primitives", () => {
  it("contains Tab focus inside the active modal", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ModalFocusContainment />
        <button type="button">Outside</button>
        <div role="dialog" aria-modal="true" aria-label="Trap harness">
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    first.focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();

    outside.focus();
    await user.tab();
    expect(first).toHaveFocus();
  });

  it("uses arrow-key navigation for map views", async () => {
    const user = userEvent.setup();
    render(<LensHarness />);
    const plan = screen.getByRole("tab", { name: "Plan" });
    plan.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Area activity" })).toHaveAttribute(
      "data-state",
      "active",
    );
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Reach" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("keeps the disabled priority-audience view separate from its reason", () => {
    render(<LensHarness influenceAvailable={false} />);
    const influence = screen.getByRole("tab", { name: "Priority audience" });
    expect(influence).toBeDisabled();
    expect(influence).toHaveAccessibleDescription("Priority-audience data is not available");
  });

  it("returns the controlled map state to plan when Influence becomes unavailable", async () => {
    render(<LensHarness influenceAvailable={false} initialLens="influence" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Current map view")).toHaveTextContent("plan");
    });
    expect(screen.getByRole("tab", { name: "Plan" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});
