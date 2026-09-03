import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextStrip } from "@/features/PlanningContextStrip";
import { resolveLagosPlanningContext } from "@/survey/lagosPlanningContext";

const brief = {
  targetAudience: "Students, young workers, and convenience shoppers",
  productDescription: "Affordable on-the-go refreshment launch",
  sector: "fmcg" as const,
};

const studentContext = resolveLagosPlanningContext({
  objective: "broad_reach",
  brief,
});

const manualContext = resolveLagosPlanningContext({
  objective: "broad_reach",
  brief,
  choice: { mode: "manual", profileId: "occupation:business-trader" },
});

describe("PlanningContextStrip", () => {
  it("shows three automatic segment-specific Lagos signals and their context boundary", () => {
    render(
      <PlanningContextStrip
        context={studentContext}
        onExplore={() => undefined}
      />,
    );

    const region = screen.getByRole("region", { name: "Planning context" });
    expect(region).toHaveAttribute("data-audience-lens-mode", "automatic");
    expect(
      screen.getByRole("group", { name: "Survey audience lens" }),
    ).toHaveTextContent("Aged 18–25");
    expect(screen.getAllByTestId("planning-context-signal")).toHaveLength(3);
    expect(screen.getByText("4.12 / 5")).toBeVisible();
    expect(screen.getByText("35%")).toBeVisible();
    expect(screen.getByText("23%")).toBeVisible();
    expect(screen.getByText("Lagos")).toBeVisible();
    expect(screen.getByText("n=43")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText("Context only")).toBeVisible();
    expect(screen.getByText(/Matched brief terms: “students”/)).toBeVisible();
  });

  it("makes a manual override explicit and switches only the survey context", () => {
    render(
      <PlanningContextStrip
        context={manualContext}
        onExplore={() => undefined}
      />,
    );

    const region = screen.getByRole("region", { name: "Planning context" });
    expect(region).toHaveAttribute("data-audience-lens-mode", "manual");
    expect(
      screen.getByRole("group", { name: "Survey audience lens" }),
    ).toHaveTextContent("Business owners and traders");
    expect(screen.getByText("Manual override")).toBeVisible();
    expect(screen.getByText(/Automatic suggestion: Aged 18–25/)).toBeVisible();
    expect(screen.getByText("n=77")).toBeVisible();
    expect(screen.getByText("4.09 / 5")).toBeVisible();
    expect(screen.getByText("39%")).toBeVisible();
    expect(screen.getByText("30%")).toBeVisible();
  });

  it("opens the review surface through an explicit dialog action", async () => {
    const onExplore = vi.fn();
    render(
      <PlanningContextStrip context={studentContext} onExplore={onExplore} />,
    );

    const action = screen.getByRole("button", {
      name: "Explore survey context",
    });
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(action);
    expect(onExplore).toHaveBeenCalledOnce();
  });
});
