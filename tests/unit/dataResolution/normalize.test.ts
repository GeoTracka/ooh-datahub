import { describe, expect, it } from "vitest";
import {
  ENTITY_RESOLVER_VERSION,
  canonicalEntityId,
  normalizeEntityLiteral,
  sourceDisplayLiteral,
  stableResolutionId,
  strictSiteIdentity,
} from "../../../src/dataResolution/normalize";

describe("entity resolution normalization", () => {
  it("uses NFKC plus conservative case/punctuation/whitespace normalization", () => {
    expect(sourceDisplayLiteral("  ＡＣＭＥ   LTD.  ")).toBe("ACME LTD.");
    expect(normalizeEntityLiteral("  ＡＣＭＥ—LTD.  ")).toBe("acme ltd");
    expect(normalizeEntityLiteral("ACME/LTD")).toBe("acme ltd");
    expect(normalizeEntityLiteral("Café Media")).toBe("café media");
    expect(normalizeEntityLiteral("Cafe Media")).toBe("cafe media");
  });

  it("keeps stable IDs resolver-versioned", () => {
    expect(canonicalEntityId("brand", "spark")).toBe(
      canonicalEntityId("brand", "spark"),
    );
    expect(canonicalEntityId("brand", "spark")).not.toBe(
      canonicalEntityId("brand", "spark", "entity-resolver-v2"),
    );
    expect(stableResolutionId("entity", ENTITY_RESOLVER_VERSION, "brand", "spark"))
      .toBe(canonicalEntityId("brand", "spark"));
  });

  it("forms a strict candidate site key without fuzzy address matching", () => {
    const first = strictSiteIdentity({
      state: "LAGOS",
      city: "Ikeja",
      address: "1 Allen Ave.",
      boardType: "Billboard",
      format: "Large-Format",
    });
    const equivalent = strictSiteIdentity({
      state: " Lagos ",
      city: "IKEJA",
      address: "1 Allen Ave",
      boardType: "BILLBOARD",
      format: "Large Format",
    });
    expect(first).not.toBeNull();
    expect(equivalent?.siteId).toBe(first?.siteId);

    const genuinelyDifferent = strictSiteIdentity({
      state: "Lagos",
      city: "Ikeja",
      address: "11 Allen Ave",
      boardType: "Billboard",
      format: "Large Format",
    });
    expect(genuinelyDifferent?.siteId).not.toBe(first?.siteId);
    expect(strictSiteIdentity({
      state: "Lagos",
      city: "Ikeja",
      address: null,
      boardType: "Billboard",
      format: "Large Format",
    })).toBeNull();
  });
});
