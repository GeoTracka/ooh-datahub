import { describe, expect, it, vi } from "vitest";
import { createEnrichmentGateway } from "@/server/enrichment/gateway";

const row = {
  rowId: "asset-1",
  address: "Herbert Macaulay Way Yaba",
  spatialRights: "customer_captured" as const,
};

function gateway() {
  return createEnrichmentGateway({
    now: () => new Date("2026-08-03T12:00:00.000Z"),
    geocoder: {
      geocode: vi.fn(async () => ({ status: "NO_RESULTS" as const, candidates: [] })),
    },
    enabled: true,
    maxRows: 50,
    maxCalls: 50,
    signingSecret: "test-preflight-secret-at-least-32-bytes",
  });
}

describe("enrichment gateway caller binding", () => {
  it("rejects a run when the signed preflight belongs to another principal or grant", async () => {
    const instance = gateway();
    const preflight = instance.preflight({
      rows: [row],
      principalId: "user-a",
      grantId: "grant-a",
    });
    await expect(instance.run({
      preflightId: preflight.id,
      rows: [row],
      authorized: true,
      idempotencyKey: "caller-mismatch-1",
      principalId: "user-b",
      grantId: "grant-a",
    })).rejects.toThrow("PREFLIGHT_CALLER_MISMATCH");
    await expect(instance.run({
      preflightId: preflight.id,
      rows: [row],
      authorized: true,
      idempotencyKey: "grant-mismatch-1",
      principalId: "user-a",
      grantId: "grant-b",
    })).rejects.toThrow("PREFLIGHT_CALLER_MISMATCH");
  });

  it("allows the same caller/grant binding across route instances", async () => {
    const issued = gateway().preflight({
      rows: [row],
      principalId: "user-a",
      grantId: "grant-a",
    });
    await expect(gateway().run({
      preflightId: issued.id,
      rows: [row],
      authorized: true,
      idempotencyKey: "caller-bound-1",
      principalId: "user-a",
      grantId: "grant-a",
    })).resolves.toEqual([{ status: "NO_RESULTS", candidates: [] }]);
  });
});
