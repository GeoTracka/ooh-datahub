import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";
import { RecommendationCarousel } from "@/features/RecommendationCarousel";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

const zoneCard = {
  rank: 1,
  zoneId: "yaba",
  label: "Yaba / Akoka",
  siteIds: ["yaba-face-1"],
  sites: [{ id: "yaba-face-1", label: "Yaba corridor" }],
  activityPotential: 72,
  marginalReach: 12000,
  marginalInfluencePoints: null,
  marginalInfluenceMass: null,
  marginalServiceableReach: null,
  role: "Lead delivery zone",
};

describe("semantic explorer UX", () => {
  it("labels zone contribution metrics as marginal and surfaces role/evidence", () => {
    render(
      <RecommendationCarousel
        cards={[zoneCard]}
        objective="broad_reach"
        evidenceLabel="Evidence D"
        selectedZoneId="yaba"
        onSelect={() => undefined}
        onExplain={() => undefined}
      />,
    );

    expect(screen.getByText("Marginal target reach")).toBeInTheDocument();
    expect(screen.queryByText(/^Target reach$/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Lead delivery zone").length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence D")).toBeInTheDocument();
    expect(screen.getByText(/incremental contribution to the selected package/)).toBeInTheDocument();
  });

  it("applies coherent campaign-profile presets and exposes persistent selection state", async () => {
    const user = userEvent.setup();
    render(<PlannerPage />);

    const preset = screen.getByRole("button", { name: "Real Estate · Influential core" });
    await user.click(preset);

    expect(preset).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Campaign profile summary" }))
      .toHaveTextContent("Harbour Residences");
    expect(screen.getByRole("region", { name: "Campaign profile summary" }))
      .toHaveTextContent("Affluent professionals, property investors, and diaspora buyers");

    await user.click(screen.getByText("Edit campaign details"));
    expect(screen.getByLabelText("Product name")).toHaveValue("Harbour Residences");
    expect(screen.getByLabelText("Product information"))
      .toHaveValue("Premium Lagos residential development for buyers and investors");
    expect(screen.getByLabelText("Target audience"))
      .toHaveValue("Affluent professionals, property investors, and diaspora buyers");
    expect(screen.getByLabelText("Sector")).toHaveValue("real_estate");
    expect(screen.getByLabelText("Objective")).toHaveValue("influential_core");
  });

  it("coalesces many form keystrokes into one planner draft decision", async () => {
    const user = userEvent.setup();
    render(<PlannerPage />);

    await user.click(screen.getByRole("button", { name: "Use default timing & budget" }));
    await screen.findByRole("region", { name: /Step 3 of 5: Choose a planning approach/ });
    await user.click(screen.getByRole("button", { name: "Back" }));

    const budget = screen.getByLabelText("Budget (NGN)");
    await user.clear(budget);
    await user.type(budget, "20000000");
    await user.click(screen.getByRole("button", { name: "Show recommended zones" }));
    await screen.findByRole("region", { name: /Step 3 of 5: Choose a planning approach/ });

    await user.click(screen.getByRole("button", { name: "Fine-tune selected package" }));
    expect(screen.getByText("Unapplied changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getByText("Fine-tune package")).toBeInTheDocument();
    expect(screen.queryByText("Unapplied changes")).not.toBeInTheDocument();
  }, 30000);
});
