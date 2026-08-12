import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UploadedContextPanel } from "@/features/UploadedContextPanel";

const row = {
  rowId: "UP-001",
  assetId: "UP-001",
  supplier: "Upload Media",
  address: "Yaba",
  format: "static",
  rateNgn: 3_200_000,
  nearestSelectedZone: { id: "yaba", label: "Yaba / Akoka", distanceKm: 0.8 },
  formatFit: "matches_package" as const,
  rateDeltaPercent: -8.4,
  metadataCompleteness: 1,
  decisionUse: "context_only" as const,
  deliveryEligible: false as const,
};

describe("UploadedContextPanel", () => {
  it("shows commercial/spatial comparison without presenting delivery metrics", async () => {
    render(<UploadedContextPanel rows={[row]} />);
    await userEvent.click(screen.getByText(/Uploaded inventory/));
    expect(screen.getByText(/Yaba \/ Akoka · 0.8 km/)).toBeInTheDocument();
    expect(screen.getByText(/matches package formats/)).toBeInTheDocument();
    expect(screen.getByText(/-8% vs the typical selected-location rate/)).toBeInTheDocument();
    expect(screen.getByText(/do not change audience estimates or the plan score/))
      .toBeInTheDocument();
  });
});
