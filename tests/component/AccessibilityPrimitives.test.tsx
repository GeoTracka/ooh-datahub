import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MapLens } from "@/contracts/renderer";
import { LensTabs } from "@/features/LensTabs";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";

function LensHarness() {
  const [lens, setLens] = useState<MapLens>("plan");
  return <LensTabs active={lens} onChange={setLens} influenceAvailable={true} />;
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

  it("uses arrow-key navigation for map lenses", async () => {
    const user = userEvent.setup();
    render(<LensHarness />);
    const plan = screen.getByRole("tab", { name: "Plan" });
    plan.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute(
      "data-state",
      "active",
    );
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Reach" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});
