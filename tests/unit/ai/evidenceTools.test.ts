import { describe, expect, it } from "vitest";

import { createEvidenceTools } from "@/server/ai/tools/evidenceTools";
import { createEvidenceToolRegistry } from "@/server/ai/tools/registry";
import { fakeEvidenceRepository } from "../../fixtures/aiRuntime";

function expectOpenAiStrictSchema(schema: unknown): void {
  if (!schema || typeof schema !== "object") return;
  const value = schema as Record<string, unknown>;
  if (value.type === "object") {
    const properties = (value.properties ?? {}) as Record<string, unknown>;
    expect(value.additionalProperties).toBe(false);
    expect([...(value.required as string[] | undefined ?? [])].sort()).toEqual(
      Object.keys(properties).sort(),
    );
    Object.values(properties).forEach(expectOpenAiStrictSchema);
  }
  if (value.items) expectOpenAiStrictSchema(value.items);
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = value[keyword];
    if (Array.isArray(variants)) variants.forEach(expectOpenAiStrictSchema);
  }
}

describe("AI evidence tools", () => {
  it("refuses respondent rows and blocked delivery claims", async () => {
    const tools = createEvidenceTools(fakeEvidenceRepository());
    await expect(
      tools.searchEvidence({
        query: "show respondent GPS",
        cityIds: ["lagos"],
        ageBands: null,
        genders: null,
      }),
    ).rejects.toThrow("UNSUPPORTED_EVIDENCE_QUERY");
    await expect(
      tools.searchEvidence({
        query: "absolute site reach",
        cityIds: ["lagos"],
        ageBands: null,
        genders: null,
      }),
    ).rejects.toThrow("UNSUPPORTED_EVIDENCE_QUERY");
  });

  it("returns bounded cited evidence for a supported question", async () => {
    const tools = createEvidenceTools(fakeEvidenceRepository());
    await expect(
      tools.searchEvidence({
        query: "travel attention",
        cityIds: ["lagos"],
        ageBands: null,
        genders: null,
      }),
    ).resolves.toMatchObject({
      summary: expect.any(String),
      answers: [
        expect.objectContaining({
          factId: "journey-attention-lagos",
          respondentBase: 50,
        }),
      ],
    });
  });

  it("rejects unknown cities and comparisons over five cities", async () => {
    const tools = createEvidenceTools(fakeEvidenceRepository());
    await expect(
      tools.getCityProfile({ cityId: "accra" as "lagos" }),
    ).rejects.toThrow();
    await expect(
      tools.compareCities({
        cityIds: ["lagos", "ibadan", "asaba", "abuja", "kano", "enugu"],
        topic: "mobility",
      }),
    ).rejects.toThrow();
  });

  it("publishes strict closed function schemas and revalidates arguments", async () => {
    const registry = createEvidenceToolRegistry(
      createEvidenceTools(fakeEvidenceRepository()),
    );
    expect(registry.definitions).toHaveLength(7);
    expect(registry.definitions.every((definition) => definition.strict)).toBe(true);
    expect(
      registry.definitions.every(
        (definition) => definition.parameters.additionalProperties === false,
      ),
    ).toBe(true);
    registry.definitions.forEach((definition) =>
      expectOpenAiStrictSchema(definition.parameters),
    );
    await expect(
      registry.byName
        .get("get_city_profile")!
        .execute(JSON.stringify({ cityId: "lagos", extra: true })),
    ).rejects.toThrow();
  });
});
