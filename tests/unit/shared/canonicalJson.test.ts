import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/shared/canonicalJson";

describe("canonicalJson", () => {
  it("sorts object keys recursively without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [3, 1] }))
      .toBe('{"a":{"b":3,"y":2},"list":[3,1],"z":1}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ value: Number.NaN }))
      .toThrow("Non-finite number");
  });
});
