import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextStrip } from "@/features/PlanningContextStrip";
import { lagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";

describe("PlanningContextStrip", () => {
  it("shows no more than three digest-bound Lagos signals and their context boundary", () => {
    render(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
        onExplore={() => undefined}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Planning context" }),
    ).toBeVisible();
    expect(screen.getAllByTestId("planning-context-signal")).toHaveLength(3);
    expect(screen.getByText("4.14 / 5")).toBeVisible();
    expect(screen.getByText("35%")).toBeVisible();
    expect(screen.getByText("28%")).toBeVisible();
    expect(screen.getByText("Lagos")).toBeVisible();
    expect(screen.getByText("n=204")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText("Context only")).toBeVisible();
  });

  it("opens the exploration surface through an explicit dialog action", async () => {
    const onExplore = vi.fn();
    render(
      <PlanningContextStrip
        artifact={lagosPlanningContextArtifact}
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
