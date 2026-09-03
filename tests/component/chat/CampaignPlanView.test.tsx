import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import { CampaignPlanView } from "@/features/chat/artifacts/CampaignPlanView";
import type { PlanWorkspaceArtifact } from "@/features/chat/contracts";
import { buildCampaignPlan } from "@/server/ai/tools/plannerTools";
import { validBrief } from "../../fixtures/aiRuntime";

let artifact: PlanWorkspaceArtifact;
beforeAll(async () => {
  artifact = {
    id: "11111111-1111-4111-8111-111111111111",
    revision: 1,
    saveState: "draft",
    payload: await buildCampaignPlan(validBrief),
    reason: "Create campaign plan",
    createdAt: "2026-09-03T12:00:00Z",
  };
});

describe("CampaignPlanView", () => {
  it("shows three distinct approaches without forcing a selection", async () => {
    render(<CampaignPlanView artifact={artifact} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Balanced plan" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Highest delivery" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Budget-smart plan" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: /Fine-tune plan/ }));
    expect(screen.getByLabelText("Budget (NGN)")).toBeEnabled();
  });
});
