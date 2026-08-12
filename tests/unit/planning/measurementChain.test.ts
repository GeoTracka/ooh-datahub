import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";

const request = {
  sector: "fmcg" as const,
  daypart: "pm" as const,
  siteIds: ["yaba-face-1", "ikeja-face-1", "oshodi-face-1"],
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("estimatePackage", () => {
  it("runs coherent Low, Base, and High scenarios through the stable panel", () => {
    const result = estimatePackage(frozenLagosBundle, request);
    if (result.claim.kind !== "scenario_target_reach") {
      throw new Error("Expected scenario target reach, received " + result.claim.kind);
    }
    expect(result.claim.evidence).toBe("D");
    expect(result.evidence.uniqueReach).toMatchObject({ score: 40, grade: "D" });
    expect(result.evidence.influence).toMatchObject({ score: 40, grade: "D" });
    expect(result.claim.range.type).toBe("scenario");
    expect(result.claim.range.low).toBeLessThanOrEqual(result.claim.range.base);
    expect(result.claim.range.base).toBeLessThanOrEqual(result.claim.range.high);
    expect(result.influence?.kind).toBe("influence_capture");
    expect(result.stages.map((stage) => stage.id)).toEqual([
      "location", "places", "movement", "ots", "target", "unique",
    ]);
    expect(result.stages[0]).toMatchObject({ id: "location", state: "assumed" });
    expect(result.stages.find((stage) => stage.id === "places"))
      .toMatchObject({ valueText: "Area information used by the movement model" });
  });

  it("degrades to target OTS when panel scaling is outside its envelope", () => {
    const outside = structuredClone(frozenLagosBundle);
    outside.scalingEnvelope.maximumC = 0.0000011;
    const result = estimatePackage(outside, request);
    expect(result.claim.kind).toBe("target_ots");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "unique")?.state)
      .toBe("unavailable");
    expect(result.claim.caveats).toContain("A unique audience estimate is not available for the current data.");
  });

  it("reuses results only for an exact fingerprint", () => {
    const first = estimatePackage(frozenLagosBundle, request);
    const second = estimatePackage(frozenLagosBundle, request);
    const changed = estimatePackage(frozenLagosBundle, {
      ...request,
      siteIds: [...request.siteIds, "vi-face-1"],
    });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toBe(changed.fingerprint);
    expect(first.comparabilityKey).toBe(changed.comparabilityKey);
    expect(first.replay).toMatchObject({
      bundleId: "lagos-demo-v1",
      modelVersion: "conditional-poisson-demo-v1",
      featureSnapshotId: "lagos-synthetic-features-v1",
      exposureGeometryVersion: "lagos-synthetic-exposure-geometry-v1",
      overlapMethodId: "conditional-poisson-weighted-panel-v1",
      replicateSetId: "scenario-low-base-high-v1",
      seed: 260803,
    });
  });

  it("makes every displayed technical source resolvable from the manifest", () => {
    const result = estimatePackage(frozenLagosBundle, request);
    const manifestIds = new Set(frozenLagosBundle.sourceManifest.map((source) => source.id));
    const sourceIds = new Set([
      ...result.claim.sourceIds,
      ...(result.influence?.sourceIds ?? []),
    ]);
    expect([...sourceIds].every((sourceId) => manifestIds.has(sourceId))).toBe(true);
  });

  it("fingerprints every governed panel value while keeping reach comparability semantic", () => {
    const first = estimatePackage(frozenLagosBundle, request);
    const revisedQi = structuredClone(frozenLagosBundle);
    revisedQi.panel.find((member) => member.sector === "fmcg")!.qi -= 0.01;
    const second = estimatePackage(revisedQi, request);
    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(first.comparabilityKey).toBe(second.comparabilityKey);

    const revisedServiceability = structuredClone(frozenLagosBundle);
    revisedServiceability.panel.find((member) => member.sector === "fmcg")!
      .serviceability -= 0.01;
    expect(estimatePackage(revisedServiceability, request).fingerprint)
      .not.toBe(first.fingerprint);
  });

  it("changes comparability only when the mathematical feature schema changes", () => {
    const compatible = estimatePackage(frozenLagosBundle, request);
    const changedSchema = structuredClone(frozenLagosBundle);
    changedSchema.manifest.featureSchemaCompatibilityId = "lagos-context-feature-schema-v2";
    const changed = estimatePackage(changedSchema, request);
    expect(changed.comparabilityKey).not.toBe(compatible.comparabilityKey);
  });

  it("fingerprints allocation values and compares only matching allocation versions", () => {
    const baseline = estimatePackage(frozenLagosBundle, request);
    const revisedValues = structuredClone(frozenLagosBundle);
    revisedValues.sites.find((site) => site.id === request.siteIds[0])!
      .targetShareBySector.fmcg.student_buyers_18_24 -= 0.01;
    const valueChange = estimatePackage(revisedValues, request);
    expect(valueChange.fingerprint).not.toBe(baseline.fingerprint);
    expect(valueChange.comparabilityKey).toBe(baseline.comparabilityKey);

    const revisedVersion = structuredClone(revisedValues);
    const previousId = revisedVersion.targetAllocationSourceIds.fmcg;
    const nextId = "synthetic-fmcg-target-allocation-v2";
    revisedVersion.targetAllocationSourceIds.fmcg = nextId;
    revisedVersion.sourceManifest.push({
      ...revisedVersion.sourceManifest.find((source) => source.id === previousId)!,
      id: nextId,
    });
    const versionChange = estimatePackage(revisedVersion, request);
    expect(versionChange.fingerprint).not.toBe(valueChange.fingerprint);
    expect(versionChange.comparabilityKey).not.toBe(valueChange.comparabilityKey);
  });

  it("degrades incompatible target inputs to general OTS", () => {
    const expired = structuredClone(frozenLagosBundle);
    const universeSource = expired.sourceManifest.find(
      (source) => source.id === "synthetic-fmcg-target-universe-v1",
    )!;
    universeSource.periodEnd = "2026-08-31";
    const result = estimatePackage(expired, request);
    expect(result.claim.kind).toBe("general_ots");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "target")?.state)
      .toBe("unavailable");
    expect(result.stages.find((stage) => stage.id === "unique")?.state)
      .toBe("unavailable");
    expect(result.scenarios.every((scenario) =>
      scenario.targetOts === null &&
      scenario.reach === null &&
      scenario.influenceMass === null &&
      scenario.serviceableReach === null &&
      scenario.averageFrequency === null
    )).toBe(true);
  });

  it("degrades missing exposure geometry to movement instead of assuming it", () => {
    const missingGeometry = structuredClone(frozenLagosBundle);
    const site = missingGeometry.sites.find((item) => item.id === request.siteIds[0])!;
    Reflect.deleteProperty(site as unknown as Record<string, unknown>, "exposureGeometry");
    const result = estimatePackage(missingGeometry, request);
    expect(result.claim.kind).toBe("movement");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "ots")).toMatchObject({
      state: "unavailable",
      recoveryAction: expect.stringMatching(/viewing direction|visible area/i),
    });
  });

  it("degrades an unavailable flight schedule to movement", () => {
    const unavailable = structuredClone(frozenLagosBundle);
    unavailable.sites.find((site) => site.id === request.siteIds[0])!
      .deliverySchedule.availabilityEnd = "2026-08-31";
    const result = estimatePackage(unavailable, request);
    expect(result.claim.kind).toBe("movement");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "ots")?.state)
      .toBe("unavailable");
    expect(result.scenarios.every((scenario) =>
      scenario.targetOts === null &&
      scenario.reach === null &&
      scenario.influenceCapture === null &&
      scenario.influenceMass === null &&
      scenario.serviceableReach === null &&
      scenario.averageFrequency === null
    )).toBe(true);
  });

  it("materializes inclusive flight duration into target OTS", () => {
    const oneDay = estimatePackage(frozenLagosBundle, {
      ...request,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-01",
    });
    const twoDays = estimatePackage(frozenLagosBundle, {
      ...request,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-02",
    });
    expect(twoDays.scenarios[1].targetOts).toBeCloseTo(
      oneDay.scenarios[1].targetOts! * 2,
      8,
    );
    expect(twoDays.fingerprint).not.toBe(oneDay.fingerprint);
  });
});
