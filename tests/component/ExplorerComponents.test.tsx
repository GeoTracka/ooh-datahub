import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionDock } from "@/features/ActionDock";
import { RecommendationCarousel } from "@/features/RecommendationCarousel";
import { StepCard } from "@/features/StepCard";

describe("explorer components", () => {
  it("announces step progress and supports Escape back navigation", async () => {
    const onBack = vi.fn();
    render(
      <StepCard
        step={2}
        total={5}
        title="When and how much?"
        onBack={onBack}
        primaryAction={{ label: "Continue", onClick: () => undefined }}
      >
        <p>Timing controls</p>
      </StepCard>,
    );
    expect(screen.getByRole("progressbar", { name: "Campaign planning progress" }))
      .toHaveAttribute("aria-valuenow", "2");
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("keeps zone focus separate from explanation", async () => {
    const onSelect = vi.fn();
    const onExplain = vi.fn();
    const cards = [{
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
    }];
    const { rerender } = render(
      <RecommendationCarousel
        cards={cards}
        objective="broad_reach"
        selectedZoneId={null}
        onSelect={onSelect}
        onExplain={onExplain}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Yaba \/ Akoka/ }));
    expect(onSelect).toHaveBeenCalledWith("yaba");
    expect(onExplain).not.toHaveBeenCalled();

    rerender(
      <RecommendationCarousel
        cards={cards}
        objective="broad_reach"
        selectedZoneId="yaba"
        onSelect={onSelect}
        onExplain={onExplain}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View delivery story" }));
    expect(onExplain).toHaveBeenCalledWith("yaba");
  });

  it("routes each valid package outcome independently", async () => {
    const onReviewRfq = vi.fn();
    const onUpload = vi.fn();
    const onFineTune = vi.fn();
    render(
      <ActionDock
        canReviewRfq={true}
        onReviewRfq={onReviewRfq}
        onUpload={onUpload}
        onFineTune={onFineTune}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Review RFQ/ }));
    await userEvent.click(screen.getByRole("button", { name: /Upload customer inventory/ }));
    await userEvent.click(screen.getByRole("button", { name: /Fine-tune package/ }));
    expect(onReviewRfq).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledOnce();
    expect(onFineTune).toHaveBeenCalledOnce();
  });

  it("disables only the RFQ outcome when the package is invalid", () => {
    render(
      <ActionDock
        canReviewRfq={false}
        onReviewRfq={() => undefined}
        onUpload={() => undefined}
        onFineTune={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /Review RFQ/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Upload customer inventory/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Fine-tune package/ })).toBeEnabled();
  });
});
