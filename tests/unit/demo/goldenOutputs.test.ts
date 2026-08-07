import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildGoldenOutputs } from "../../../scripts/build-golden-outputs";
import { canonicalJson } from "@/shared/canonicalJson";

describe("golden outputs", () => {
  it("rebuilds all three plan and RFQ bytes exactly", async () => {
    const checkedIn = await readFile("src/demo/lagos-v1/golden-outputs.json", "utf8");
    expect(canonicalJson(buildGoldenOutputs()) + "\n").toBe(checkedIn);
  }, 120_000);
});
