import { describe, expect, it } from "vitest";
import { PUBLIC_COPY, confidenceLabel } from "@/content/plainLanguage";

function leafStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(leafStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(leafStrings);
  }
  return [];
}

describe("plain-language public copy", () => {
  it("does not expose demo framing or specialist planning jargon", () => {
    const copy = leafStrings(PUBLIC_COPY).join("\n");

    expect(copy).not.toMatch(/\b(?:synthetic|demo|marginal|headroom|cohort|serviceability|normalization|causal|eligible)\b/i);
    expect(copy).not.toMatch(/exposure geometry|planning context|Evidence [A-D]/i);
  });

  it("uses clear wording for inventory, estimates, budget and draft status", () => {
    expect(PUBLIC_COPY.campaign.defaultProductName).toBe("Spark Refresh");
    expect(PUBLIC_COPY.metrics.additionalReach).toBe("Additional people reached");
    expect(PUBLIC_COPY.metrics.planScore).toBe("Plan score");
    expect(PUBLIC_COPY.budget.remaining).toBe("Budget remaining");
    expect(PUBLIC_COPY.inventory.visibilityBasis).toBe("Inventory locations and how visible each placement is");
    expect(PUBLIC_COPY.rfq.watermark).toBe("DRAFT — NOT YET SENT");
    expect(PUBLIC_COPY.metadata.description).not.toMatch(/\breal inventory\b/i);
  });

  it("translates internal evidence grades into understandable confidence labels", () => {
    expect(confidenceLabel("A")).toBe("High confidence");
    expect(confidenceLabel("B")).toBe("Good confidence");
    expect(confidenceLabel("C")).toBe("Moderate confidence");
    expect(confidenceLabel("D")).toBe("Early estimate");
    expect(confidenceLabel("unavailable")).toBe("Data confidence unavailable");
  });
});
