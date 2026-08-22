import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextDrawer } from "@/features/PlanningContextDrawer";
import { lagosPlanningContextArtifact } from "@/survey/lagosPlanningContext";

describe("PlanningContextDrawer", () => {
  it("explains objective selection, applicable denominators, method, and the non-delivery boundary", async () => {
    const onClose = vi.fn();
    render(
      <PlanningContextDrawer
        artifact={lagosPlanningContextArtifact}
        objective="near_conversion"
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Consumer survey context" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "What people reported for this objective",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Likely customers").length).toBeGreaterThan(0);
    expect(screen.getByText("204 respondents")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText(/177 applicable responses/)).toBeVisible();
    expect(screen.getAllByText(/204 applicable responses/)).toHaveLength(2);
    expect(
      screen.getByText(
        /self-reported actions taken after noticing outdoor advertising/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/does not change the package calculation or ranking/),
    ).toBeVisible();
    expect(
      screen.getByText(/not observed movement, exposure geometry, OTS, reach/),
    ).toBeVisible();
    expect(screen.getByText(/unweighted descriptive aggregates/)).toBeVisible();

    await userEvent.click(screen.getByText("Technical source details"));
    expect(screen.getByText("near_conversion")).toBeVisible();
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
        objective="broad_reach"
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
