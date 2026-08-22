import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextStrip } from "@/features/PlanningContextStrip";
import { lagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";

describe("PlanningContextStrip", () => {
  it("shows no more than three digest-bound broad-reach signals and their boundary", () => {
    render(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
        objective="broad_reach"
        onExplore={() => undefined}
      />,
    );

    const region = screen.getByRole("region", { name: "Planning context" });
    expect(region).toHaveAttribute("data-objective", "broad_reach");
    expect(screen.getAllByTestId("planning-context-signal")).toHaveLength(3);
    expect(screen.getByText("72%")).toBeVisible();
    expect(screen.getByText("35%")).toBeVisible();
    expect(screen.getByText("38%")).toBeVisible();
    expect(screen.getByText("Lagos")).toBeVisible();
    expect(screen.getByText("Broad reach objective")).toBeVisible();
    expect(screen.getByText("n=204")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText("Context only")).toBeVisible();
  });

  it("switches only the displayed profile when the planner objective changes", () => {
    const rendered = render(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
        objective="broad_reach"
        onExplore={() => undefined}
      />,
    );

    rendered.rerender(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
        objective="influential_core"
        onExplore={() => undefined}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Planning context" }),
    ).toHaveAttribute("data-objective", "influential_core");
    expect(screen.getAllByTestId("planning-context-signal")).toHaveLength(3);
    expect(screen.getByText("4.13 / 5")).toBeVisible();
    expect(screen.getByText("36%")).toBeVisible();
    expect(screen.getByText("28%")).toBeVisible();
    expect(screen.queryByText("72%")).not.toBeInTheDocument();
  });

  it("opens the exploration surface through an explicit dialog action", async () => {
    const onExplore = vi.fn();
    render(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
        objective="near_conversion"
        onExplore={onExplore}
      />,
    );

    const action = screen.getByRole("button", {
      name: "Explore survey context",
    });
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(action);
    expect(onExplore).toHaveBeenCalledOnce();
  });
});
