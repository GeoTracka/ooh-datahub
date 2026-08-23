import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanningContextDrawer } from "@/features/PlanningContextDrawer";
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

describe("PlanningContextDrawer", () => {
  it("explains automatic resolution, review choices, denominators, source, and the non-delivery boundary", async () => {
    const onClose = vi.fn();
    const onAudienceLensChange = vi.fn();
    render(
      <PlanningContextDrawer
        context={studentContext}
        onAudienceLensChange={onAudienceLensChange}
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
    expect(screen.getAllByText("Aged 18–25").length).toBeGreaterThan(0);
    expect(screen.getByText("Automatic from brief")).toBeVisible();
    expect(screen.getByText("43 respondents")).toBeVisible();
    expect(screen.getByText("20 May–3 Jun 2026")).toBeVisible();
    expect(screen.getByText(/41 applicable responses/)).toBeVisible();
    expect(
      screen.getByText(/Occupation = Student did not clear the minimum sample/),
    ).toBeVisible();
    expect(screen.getAllByText("Age band = 18-25").length).toBeGreaterThan(0);
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

    const select = screen.getByLabelText("Audience lens");
    expect(select).toHaveValue("__automatic__");
    expect(screen.getAllByRole("option")).toHaveLength(14);
    expect(
      screen.getByRole("option", {
        name: "Business owners and traders (n=77)",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply lens" })).toBeDisabled();

    await userEvent.selectOptions(select, "occupation:business-trader");
    await userEvent.click(screen.getByRole("button", { name: "Apply lens" }));
    expect(onAudienceLensChange).toHaveBeenCalledWith({
      mode: "manual",
      profileId: "occupation:business-trader",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm automatic lens" }),
    );
    expect(onAudienceLensChange).toHaveBeenCalledWith({
      mode: "manual",
      profileId: "ageBand:18-25",
    });

    await userEvent.click(screen.getByText("Technical source details"));
    expect(
      screen.getByText(studentContext.artifact.sourceSnapshotDigest),
    ).toBeVisible();
    expect(screen.getByText(studentContext.catalogueDigest)).toBeVisible();
    expect(
      screen.getByText(studentContext.artifact.artifactDigest),
    ).toBeVisible();
    expect(screen.getByText("automatic")).toBeVisible();
  });

  it("shows a manual override and offers one-click return to the automatic match", async () => {
    const onAudienceLensChange = vi.fn();
    const manualContext = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief,
      choice: { mode: "manual", profileId: "occupation:business-trader" },
    });

    render(
      <PlanningContextDrawer
        context={manualContext}
        onAudienceLensChange={onAudienceLensChange}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Manual override")).toBeVisible();
    expect(
      screen.getAllByText("Business owners and traders").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("77 respondents")).toBeVisible();
    expect(screen.getByLabelText("Audience lens")).toHaveValue(
      "occupation:business-trader",
    );
    expect(
      screen.getByText(/instead of the automatic brief suggestion, Aged 18–25/),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Use automatic match" }),
    );
    expect(onAudienceLensChange).toHaveBeenCalledWith({ mode: "automatic" });
  });

  it("closes on Escape and restores focus to the opener after unmount", async () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    opener.textContent = "Explore survey context";
    document.body.append(opener);
    opener.focus();

    const rendered = render(
      <PlanningContextDrawer
        context={studentContext}
        onAudienceLensChange={() => undefined}
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
