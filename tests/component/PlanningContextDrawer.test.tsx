import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextDrawer } from "@/features/PlanningContextDrawer";
import { resolveLagosPlanningContext } from "@/survey/lagosPlanningContext";

const studentContext = resolveLagosPlanningContext({
  objective: "broad_reach",
  brief: {
    targetAudience: "Students, young workers, and convenience shoppers",
    productDescription: "Affordable on-the-go refreshment launch",
    sector: "fmcg",
  },
});

describe("PlanningContextDrawer", () => {
  it("explains segment resolution, denominators, source, and the non-delivery boundary", async () => {
    const onClose = vi.fn();
    render(
      <PlanningContextDrawer context={studentContext} onClose={onClose} />,
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
    expect(screen.getByText("Aged 18–25")).toBeVisible();
    expect(screen.getByText("43 respondents")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText(/41 applicable responses/)).toBeVisible();
    expect(
      screen.getByText(/Occupation = Student did not clear the minimum sample/),
    ).toBeVisible();
    expect(screen.getByText("Age band = 18-25")).toBeVisible();
    expect(screen.getByText(/“students”/)).toBeVisible();
    expect(
      screen.getByText(
        /do not change package calculations, ranking, target shares, or delivery/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/not observed movement, exposure geometry, OTS, reach/),
    ).toBeVisible();
    expect(screen.getByText(/unweighted descriptive aggregates/)).toBeVisible();

    await userEvent.click(screen.getByText("Technical source details"));
    expect(
      screen.getByText(studentContext.artifact.sourceSnapshotDigest),
    ).toBeVisible();
    expect(screen.getByText(studentContext.catalogueDigest)).toBeVisible();
    expect(
      screen.getByText(studentContext.artifact.artifactDigest),
    ).toBeVisible();
  });

  it("closes on Escape and restores focus to the opener after unmount", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    opener.textContent = "Explore survey context";
    document.body.append(opener);
    opener.focus();

    const rendered = render(
      <PlanningContextDrawer context={studentContext} onClose={onClose} />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
