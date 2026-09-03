import { beforeAll, describe, expect, it, vi } from "vitest";

import type { PlanArtifactPayload } from "@/server/artifacts/contracts";
import { buildCampaignPlan } from "@/server/ai/tools/plannerTools";
import { createArtifactExportHandler } from "@/server/exports/routeHandler";
import { validBrief } from "../../fixtures/aiRuntime";

const artifactId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "planner@example.com",
  displayName: "Planner",
};
let plan: PlanArtifactPayload;

beforeAll(async () => {
  plan = await buildCampaignPlan(validBrief);
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireUser: async () => user,
    getArtifact: async () => ({
      id: artifactId,
      revision: 2,
      saveState: "draft" as const,
      payload: plan,
      reason: "Create campaign plan",
      createdAt: new Date("2026-09-03T12:00:00Z"),
    }),
    getEvidence: vi.fn(async () => []),
    ...overrides,
  };
}

function request(format = "xlsx", revision = 2) {
  return new Request(
    `http://localhost/api/artifacts/${artifactId}/export?revision=${revision}&format=${format}`,
  );
}

describe("artifact export route", () => {
  it("authenticates before parsing or looking up an artifact", async () => {
    const getArtifact = vi.fn();
    const handler = createArtifactExportHandler(
      dependencies({
        requireUser: async () => {
          throw new Error("UNAUTHENTICATED");
        },
        getArtifact,
      }),
    );

    const response = await handler(new Request("http://localhost/bad"), "bad-id");
    expect(response.status).toBe(401);
    expect(getArtifact).not.toHaveBeenCalled();
  });

  it("does not reveal invalid, unowned or stale artifacts", async () => {
    const invalid = await createArtifactExportHandler(dependencies())(
      request(),
      "bad-id",
    );
    expect(invalid.status).toBe(404);

    const unowned = await createArtifactExportHandler(
      dependencies({
        getArtifact: async () => {
          throw new Error("ARTIFACT_NOT_FOUND");
        },
      }),
    )(request(), artifactId);
    expect(unowned.status).toBe(404);

    const stale = await createArtifactExportHandler(dependencies())(
      request("xlsx", 1),
      artifactId,
    );
    expect(stale.status).toBe(404);
  });

  it("downloads an XLSX with secure attachment headers", async () => {
    const response = await createArtifactExportHandler(dependencies())(
      request("xlsx"),
      artifactId,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="everyday-essentials-campaign-plan-r2.xlsx"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  });

  it("downloads a UTF-8 CSV from the same artifact revision", async () => {
    const response = await createArtifactExportHandler(dependencies())(
      request("csv"),
      artifactId,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain(".csv");
    await expect(response.text()).resolves.toContain(
      "Balanced plan,best_overall",
    );
  });

  it("loads only the governed facts referenced by evidence artifacts", async () => {
    const getEvidence = vi.fn(async () => [
      {
        factId: "fact-1",
        metricId: "journey_attention_high",
        label: "High attention while travelling",
        value: 60,
        unit: "percent" as const,
        numerator: 30,
        denominator: 50,
        respondentBase: 50,
        geography: "lagos",
        segment: { city: "lagos" },
        period: "2026-05",
        caveat: "Unweighted study sample; not population reach.",
        citation: {
          sourceId: "source-1",
          sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
          workbookField: "Q10",
          page: null,
        },
      },
    ]);
    const handler = createArtifactExportHandler(
      dependencies({
        getArtifact: async () => ({
          id: artifactId,
          revision: 1,
          saveState: "draft" as const,
          payload: {
            type: "evidence" as const,
            version: 1 as const,
            factIds: ["fact-1"],
            excerptIds: [],
          },
          reason: "Create evidence",
          createdAt: new Date("2026-09-03T12:00:00Z"),
        }),
        getEvidence,
      }),
    );
    const response = await handler(request("csv", 1), artifactId);

    expect(response.status).toBe(200);
    expect(getEvidence).toHaveBeenCalledWith(["fact-1"]);
    await expect(response.text()).resolves.toContain(
      "High attention while travelling,60,percent,50",
    );
  });
});
