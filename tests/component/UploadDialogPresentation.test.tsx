import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadDialog } from "@/features/UploadDialog";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="upload-map-canvas" />,
}));

vi.mock("@/import/readLocalSpreadsheet", () => ({
  readLocalSpreadsheet: vi.fn(async () => ({
    sheets: [{
      name: "Inventory",
      rows: [
        ["asset id", "address", "supplier", "format", "rate", "spatial rights"],
        ["asset-1", "10 Broad Street", "Supplier A", "48 Sheet", 1_200_000, "customer_captured"],
      ],
    }],
  })),
}));

describe("UploadDialog presentation", () => {
  it("guides an accepted local row to the offline context path without provider calls", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<UploadDialog onClose={() => undefined} onDraft={onDraft} />);

    expect(screen.getByRole("heading", { name: "Upload file" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review rows" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Use as context" })).toBeInTheDocument();

    const file = new File(["fixture"], "inventory.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Inventory spreadsheet"), file);

    await waitFor(() => {
      expect(screen.getByText(/1 accepted · 0 need attention · 0 rejected/)).toBeInTheDocument();
    });
    const offline = screen.getByRole("button", { name: /Use uploaded facts as context/ });
    expect(offline).toBeEnabled();
    expect(offline).toHaveTextContent("Offline · no provider call");
    expect(screen.queryByText("Technical preflight details")).not.toBeInTheDocument();

    await user.click(offline);
    expect(onDraft).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
