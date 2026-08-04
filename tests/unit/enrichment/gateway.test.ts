import { describe, expect, it, vi } from "vitest";
import { createEnrichmentGateway } from "@/server/enrichment/gateway";

const row = {
  rowId: "row-1",
  address: "Herbert Macaulay Way Yaba Lagos",
  spatialRights: "customer_captured" as const,
};

describe("enrichment gateway", () => {
  it("makes no provider call during preflight", async () => {
    const geocode = vi.fn();
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: { geocode },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    const preflight = gateway.preflight({ rows: [row] });
    expect(preflight.maximumCalls).toBe(1);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("requires explicit authorization and a matching preflight", async () => {
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: {
        geocode: vi
          .fn()
          .mockResolvedValue({ status: "NO_RESULTS", candidates: [] }),
      },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    const preflight = gateway.preflight({ rows: [row] });
    await expect(
      gateway.run({
        preflightId: preflight.id,
        rows: [row],
        authorized: false,
        idempotencyKey: "run-1",
      }),
    ).rejects.toThrow("AUTHORIZATION_REQUIRED");
  });

  it("accepts a signed preflight in a fresh route instance", async () => {
    const dependencies = {
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: {
        geocode: vi
          .fn()
          .mockResolvedValue({ status: "NO_RESULTS", candidates: [] }),
      },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    };
    const issued = createEnrichmentGateway(dependencies).preflight({
      rows: [row],
    });
    const freshRouteInstance = createEnrichmentGateway(dependencies);
    await expect(
      freshRouteInstance.run({
        preflightId: issued.id,
        rows: [row],
        authorized: true,
        idempotencyKey: "fresh-route-1",
      }),
    ).resolves.toEqual([{ status: "NO_RESULTS", candidates: [] }]);
  });

  it("refuses more than 50 rows", () => {
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: { geocode: vi.fn() },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    expect(() =>
      gateway.preflight({
        rows: Array.from({ length: 51 }, (_, index) => ({
          ...row,
          rowId: String(index),
        })),
      }),
    ).toThrow("MAX_ROWS");
  });
});
