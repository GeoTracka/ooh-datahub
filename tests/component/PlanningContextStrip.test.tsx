import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextStrip } from "@/features/PlanningContextStrip";
import { resolveLagosPlanningContext } from "@/survey/lagosPlanningContext";

const studentContext = resolveLagosPlanningContext({
  objective: "broad_reach",
  brief: {
    targetAudience: "Students, young workers, and convenience shoppers",
    productDescription: "Affordable on-the-go refreshment launch",
    sector: "fmcg",
  },
});

describe("PlanningContextStrip", () => {
  it("shows three segment-specific Lagos signals and their context boundary", () => {
    render(
      <PlanningContextStrip
        context={studentContext}
        onExplore={() => undefined}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Planning context" }),
    ).toBeVisible();
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

  it("opens the exploration surface through an explicit dialog action", async () => {
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
