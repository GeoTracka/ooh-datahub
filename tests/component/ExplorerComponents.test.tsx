import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionDock } from "@/features/ActionDock";
import { buildPlan } from "@/application/plannerService";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { PackageOptionComparison } from "@/features/PackageOptionComparison";
import { RecommendationCarousel } from "@/features/RecommendationCarousel";
import { StepCard } from "@/features/StepCard";

describe("explorer components", () => {
  it("compares three distinct package approaches with single-selection semantics", async () => {
    const plan = buildPlan(frozenLagosBundle, {
      productName: "Demo Spark",
      productDescription: "Affordable on-the-go refreshment launch",
      targetAudience: "Students, young workers, and convenience shoppers",
      sector: "fmcg",
      objective: "broad_reach",
      daypart: "pm",
      budgetNgn: 18_000_000,
      normalizationBudgetNgn: 30_000_000,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-28",
    });
    const onSelect = vi.fn();
    render(
      <PackageOptionComparison
        plan={plan}
        selectedPackageId={plan.recommended.id}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Planning approaches" }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Best overall/ })).toBeChecked();
    expect(screen.getByText("Maximum delivery")).toBeInTheDocument();
    expect(screen.getByText("Budget smart")).toBeInTheDocument();
    expect(screen.getByText("Best overall").closest("label"))
      .toHaveTextContent(/\d+(?:\.\d+)?K people/);

    await userEvent.click(screen.getByRole("radio", { name: /Budget smart/ }));
    expect(onSelect).toHaveBeenCalledWith(plan.packageOptions[2].candidate);
  }, 30_000);

  it("explains when constraints limit the package cohort", () => {
    const plan = buildPlan(frozenLagosBundle, {
      productName: "Demo Spark",
      productDescription: "Affordable on-the-go refreshment launch",
      targetAudience: "Students, young workers, and convenience shoppers",
      sector: "fmcg",
      objective: "broad_reach",
      daypart: "pm",
      budgetNgn: 18_000_000,
      normalizationBudgetNgn: 30_000_000,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-28",
    });
    const limited = { ...plan, packageOptions: plan.packageOptions.slice(0, 2) };

    render(
      <PackageOptionComparison
        plan={limited}
        selectedPackageId={limited.recommended.id}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("2 ways to plan")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/constraints limited this comparison/i);
  }, 30_000);

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

  it("keeps zone focus separate from explanation and supports a full-package reset", async () => {
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
        evidenceLabel="Evidence D"
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
        evidenceLabel="Evidence D"
        selectedZoneId="yaba"
        onSelect={onSelect}
        onExplain={onExplain}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View delivery story" }));
    expect(onExplain).toHaveBeenCalledWith("yaba");
    await userEvent.click(screen.getByRole("button", { name: "Clear zone focus" }));
    expect(onSelect).toHaveBeenCalledWith(null);
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
