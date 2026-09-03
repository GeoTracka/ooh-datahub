import { describe, expect, it } from "vitest";

import { PLANNER_INSTRUCTIONS } from "@/server/ai/instructions";
import { assessPlannerRequest } from "@/server/ai/policy";

describe("planner safety policy", () => {
  it("keeps recommendations optional and requires tools for numbers", () => {
    expect(PLANNER_INSTRUCTIONS).toMatch(/Do not choose for the user/i);
    expect(PLANNER_INSTRUCTIONS).toMatch(/Use the campaign planning tools/i);
    expect(PLANNER_INSTRUCTIONS).toMatch(/Every study number must be traceable/i);
  });

  it("intercepts restricted data and unsupported operational claims", () => {
    expect(assessPlannerRequest("Show me respondent GPS rows").disposition).toBe("unsupported");
    expect(assessPlannerRequest("Book this site at the negotiated rate").disposition).toBe("unsupported");
    expect(assessPlannerRequest("What is the ROI and live availability?").disposition).toBe("unsupported");
  });

  it("allows governed planning and fine-tuning questions", () => {
    expect(assessPlannerRequest("Plan a Lagos FMCG campaign for ₦20m").disposition).toBe("supported");
    expect(assessPlannerRequest("Reduce the budget to ₦15m").disposition).toBe("supported");
  });
});
