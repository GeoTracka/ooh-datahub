import { afterEach, describe, expect, it } from "vitest";
import {
  accessGrantForRequest,
  assertGrantCallAllowance,
  signEnrichmentAccessGrant,
  verifyEnrichmentAccessGrant,
} from "@/server/enrichment/access";

const secret = "test-enrichment-access-secret-at-least-32-bytes";
const now = new Date("2026-08-03T12:00:00.000Z");
const grant = {
  principalId: "user-123",
  tenantId: "tenant-1",
  grantId: "grant-abc",
  expiresAt: "2026-08-03T12:05:00.000Z",
  maxCalls: 2,
};

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("enrichment access grants", () => {
  it("verifies a short-lived signed grant", () => {
    const token = signEnrichmentAccessGrant(grant, secret);
    expect(verifyEnrichmentAccessGrant(token, secret, now)).toEqual(grant);
  });

  it("rejects tampering, expiry, and grants longer than ten minutes", () => {
    const token = signEnrichmentAccessGrant(grant, secret);
    expect(() => verifyEnrichmentAccessGrant(token + "x", secret, now))
      .toThrow("ENRICHMENT_ACCESS_GRANT_INVALID");
    expect(() => verifyEnrichmentAccessGrant(
      signEnrichmentAccessGrant({ ...grant, expiresAt: now.toISOString() }, secret),
      secret,
      now,
    )).toThrow("ENRICHMENT_ACCESS_GRANT_EXPIRED");
    expect(() => verifyEnrichmentAccessGrant(
      signEnrichmentAccessGrant({
        ...grant,
        expiresAt: "2026-08-03T12:11:00.000Z",
      }, secret),
      secret,
      now,
    )).toThrow("ENRICHMENT_ACCESS_GRANT_TOO_LONG");
  });

  it("enforces the call allowance encoded by the upstream quota authority", () => {
    expect(() => assertGrantCallAllowance(grant, [
      { address: "A" },
      { address: "B" },
      { address: "C" },
    ])).toThrow("ENRICHMENT_GRANT_CALL_LIMIT");
    expect(() => assertGrantCallAllowance(grant, [
      { address: "A" },
      { address: "B" },
      {},
    ])).not.toThrow();
  });

  it("requires upstream quota mode and a signed header only when live enrichment is enabled", () => {
    process.env.LIVE_ENRICHMENT_ENABLED = "false";
    expect(accessGrantForRequest(new Request("https://example.test"))).toBeNull();

    process.env.LIVE_ENRICHMENT_ENABLED = "true";
    process.env.ENRICHMENT_QUOTA_ENFORCEMENT = "disabled";
    expect(() => accessGrantForRequest(new Request("https://example.test")))
      .toThrow("ENRICHMENT_UPSTREAM_QUOTA_REQUIRED");

    process.env.ENRICHMENT_QUOTA_ENFORCEMENT = "upstream";
    process.env.ENRICHMENT_ACCESS_GRANT_SECRET = secret;
    expect(() => accessGrantForRequest(new Request("https://example.test")))
      .toThrow("ENRICHMENT_ACCESS_GRANT_REQUIRED");
  });
});
