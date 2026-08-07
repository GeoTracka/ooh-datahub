import { describe, expect, it } from "vitest";
import { mapHeaders } from "@/import/mapHeaders";

describe("mapHeaders", () => {
  it("maps exact aliases and requires confirmation for approximate matches", () => {
    const result = mapHeaders(["Billboard ID", "Site Location Address", "Unexpected Metric"]);
    expect(result[0]).toMatchObject({ target: "assetId", confidence: 1, confirmed: true });
    expect(result[1]).toMatchObject({ target: "address", confirmed: false });
    expect(result[2]).toMatchObject({ target: null, confirmed: false });
  });
});
