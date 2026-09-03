import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ArtifactPayload } from "@/server/artifacts/contracts";
import {
  PrepareArtifactExportArgsSchema,
  prepareArtifactExport,
} from "@/server/ai/tools/exportTools";
import { buildCampaignPlan } from "@/server/ai/tools/plannerTools";
import { validBrief } from "../../fixtures/aiRuntime";

const artifactId = "11111111-1111-4111-8111-111111111111";
let plan: ArtifactPayload;

beforeAll(async () => {
  plan = await buildCampaignPlan(validBrief);
});

function reader(payload: ArtifactPayload, revision = 2) {
  return vi.fn(async () => ({
    id: artifactId,
    revision,
    saveState: "draft" as const,
    payload,
    reason: "Test artifact",
    createdAt: new Date("2026-09-03T12:00:00Z"),
  }));
}

describe("prepare_artifact_export", () => {
  it("prepares both download formats for an owned campaign revision", async () => {
    const getArtifact = reader(plan);

    await expect(
      prepareArtifactExport(
        { artifactId, expectedRevision: 2 },
        { ownerId: "user_1", getArtifact },
      ),
    ).resolves.toEqual({
      artifactId,
      revision: 2,
      reportKind: "campaign_plan",
      title: "Everyday essentials campaign plan",
      filename: "everyday-essentials-campaign-plan-r2",
      formats: ["xlsx", "csv"],
    });
    expect(getArtifact).toHaveBeenCalledWith(artifactId, "user_1");
  });

  it("prepares a governed evidence report", async () => {
    const evidence: ArtifactPayload = {
      type: "evidence",
      version: 1,
      factIds: ["fact-1"],
      excerptIds: [],
    };

    await expect(
      prepareArtifactExport(
        { artifactId, expectedRevision: 1 },
        { ownerId: "user_1", getArtifact: reader(evidence, 1) },
      ),
    ).resolves.toMatchObject({
      reportKind: "evidence_report",
      title: "Outdoor audience evidence report",
      filename: "outdoor-audience-evidence-report-r1",
    });
  });

  it("fails closed for a stale revision", async () => {
    await expect(
      prepareArtifactExport(
        { artifactId, expectedRevision: 1 },
        { ownerId: "user_1", getArtifact: reader(plan, 2) },
      ),
    ).rejects.toThrow("STALE_ARTIFACT_REVISION:2:1");
  });

  it("does not prepare map or audience artifacts", async () => {
    const map: ArtifactPayload = {
      type: "map",
      version: 1,
      planRevision: 1,
      zoneIds: [],
      siteIds: [],
      selectedFeatureId: null,
    };

    await expect(
      prepareArtifactExport(
        { artifactId, expectedRevision: 1 },
        { ownerId: "user_1", getArtifact: reader(map, 1) },
      ),
    ).rejects.toThrow("UNSUPPORTED_EXPORT_ARTIFACT");
  });

  it("requires a strict UUID and positive revision", () => {
    expect(() =>
      PrepareArtifactExportArgsSchema.parse({
        artifactId: "not-an-id",
        expectedRevision: 0,
        format: "xlsx",
      }),
    ).toThrow();
  });
});
