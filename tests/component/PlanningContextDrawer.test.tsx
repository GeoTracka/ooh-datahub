import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextDrawer } from "@/features/PlanningContextDrawer";
import { lagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";

describe("PlanningContextDrawer", () => {
  it("explains source, objective selection, denominators, and the non-delivery boundary", async () => {
    const onClose = vi.fn();
    render(
      <PlanningContextDrawer
        artifact={lagosPlanningContextArtifact}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Consumer survey context" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "What people reported about outdoor advertising",
      }),
    ).toBeVisible();
    expect(screen.getByText("Broad reach")).toBeVisible();
    expect(screen.getByText("204 respondents")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText(/177 applicable responses/)).toBeVisible();
    expect(screen.getByText(/202 applicable responses/)).toBeVisible();
    expect(
      screen.getByText(
        /objective selects which survey facts are shown; it does not change package calculations or ranking/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/not observed movement, exposure geometry, OTS, reach/),
    ).toBeVisible();
    expect(screen.getByText(/unweighted descriptive aggregates/)).toBeVisible();

    await userEvent.click(screen.getByText("Technical source details"));
    expect(
      screen.getByText(lagosPlanningContextArtifact.sourceSnapshotDigest),
    ).toBeVisible();
    expect(
      screen.getByText(lagosPlanningContextArtifact.artifactDigest),
    ).toBeVisible();
  });

  it("closes on Escape and restores focus to the opener after unmount", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    opener.textContent = "Explore survey context";
    document.body.append(opener);
    opener.focus();

    const rendered = render(
      <PlanningContextDrawer
        artifact={lagosPlanningContextArtifact}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
