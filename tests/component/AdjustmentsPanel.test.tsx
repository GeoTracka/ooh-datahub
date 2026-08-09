import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdjustmentsPanel } from "@/features/AdjustmentsPanel";
import type { AdjustmentOptions } from "@/application/plannerService";

const options: AdjustmentOptions = {
  selectedSites: [
    { id: "site-a", label: "Yaba Main Road", zoneId: "zone-a", zoneLabel: "Yaba", supplierId: "supplier-a", rateNgn: 2_000_000 },
    { id: "site-b", label: "Lekki Gate", zoneId: "zone-b", zoneLabel: "Lekki", supplierId: "supplier-b", rateNgn: 3_000_000 },
  ],
  addableSites: [
    { id: "site-a2", label: "Akoka Junction", zoneId: "zone-a", zoneLabel: "Yaba", supplierId: "supplier-a", rateNgn: 1_500_000 },
  ],
  replacementSitesBySelectedSite: {
    "site-a": [
      { id: "site-a3", label: "Tejuosho Approach", zoneId: "zone-a", zoneLabel: "Yaba", supplierId: "supplier-c", rateNgn: 1_800_000 },
    ],
    "site-b": [],
  },
  selectedZones: [
    { id: "zone-a", label: "Yaba" },
    { id: "zone-b", label: "Lekki" },
  ],
  alternativeZones: [{ id: "zone-c", label: "Ikeja" }],
};

describe("AdjustmentsPanel", () => {
  it("requires the user to choose concrete objects before each mutation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onSwap = vi.fn();
    const onReplaceZone = vi.fn();
    const onRemove = vi.fn();
    render(
      <AdjustmentsPanel
        isDirty={false}
        options={options}
        deltas={null}
        invalidReasons={[]}
        onAdd={onAdd}
        onSwap={onSwap}
        onReplaceZone={onReplaceZone}
        onRemove={onRemove}
        onUndo={() => undefined}
        onReset={() => undefined}
      />,
    );

    const add = screen.getByRole("button", { name: "Add selected face" });
    const swap = screen.getByRole("button", { name: "Swap selected face" });
    const replace = screen.getByRole("button", { name: "Replace selected zone" });
    const remove = screen.getByRole("button", { name: "Remove selected face" });
    expect(add).toBeDisabled();
    expect(swap).toBeDisabled();
    expect(replace).toBeDisabled();
    expect(remove).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Face to add"), "site-a2");
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith("site-a2");

    await user.selectOptions(screen.getByLabelText("Current face to swap"), "site-a");
    await user.selectOptions(screen.getByLabelText("Replacement face"), "site-a3");
    await user.click(swap);
    expect(onSwap).toHaveBeenCalledWith("site-a", "site-a3");

    await user.selectOptions(screen.getByLabelText("Current zone to replace"), "zone-a");
    await user.selectOptions(screen.getByLabelText("Replacement zone"), "zone-c");
    await user.click(replace);
    expect(onReplaceZone).toHaveBeenCalledWith("zone-a", "zone-c");

    await user.selectOptions(screen.getByLabelText("Face to remove"), "site-b");
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledWith("site-b");
  });

  it("keeps technical identifiers out of the default impact summary", () => {
    render(
      <AdjustmentsPanel
        isDirty={false}
        options={options}
        deltas={null}
        invalidReasons={[]}
        onAdd={() => undefined}
        onSwap={() => undefined}
        onReplaceZone={() => undefined}
        onRemove={() => undefined}
        onUndo={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(screen.getByText(/Yaba Main Road/)).toBeInTheDocument();
    expect(screen.queryByText(/Fingerprint/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comparability/)).not.toBeInTheDocument();
  });
});
