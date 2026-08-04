import { describe, expect, it } from "vitest";
import { buildDemoBundle } from "../../../scripts/build-demo-bundle";
import { validateFrozenBundle } from "@/bundle/validateFrozenBundle";
import { canonicalJson } from "@/shared/canonicalJson";

describe("frozen Lagos bundle", () => {
  it("is deterministic and remains Evidence D", () => {
    const first = buildDemoBundle();
    const second = buildDemoBundle();
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(first.manifest.maximumEvidenceGrade).toBe("D");
  });

  it("reconciles panel weights to every target universe", () => {
    const bundle = validateFrozenBundle(buildDemoBundle());
    for (const target of bundle.targets) {
      const weight = bundle.panel
        .filter((member) => member.sector === target.sector && member.cellId === target.cellId)
        .reduce((sum, member) => sum + member.weight, 0);
      expect(weight).toBeCloseTo(target.universe, 6);
    }
  });

  it("uses one mutually exclusive target partition per sector", () => {
    const bundle = validateFrozenBundle(buildDemoBundle());
    expect(bundle.targets.every((target) => target.membership === "mutually_exclusive"))
      .toBe(true);
    expect(new Set(bundle.panel.map((member) => member.id)).size)
      .toBe(bundle.panel.length);
    for (const member of bundle.panel) {
      expect(bundle.targets.filter((target) =>
        target.sector === member.sector && target.cellId === member.cellId,
      )).toHaveLength(1);
    }
  });

  it("contains exactly Low, Base, and High coherent scenarios", () => {
    const scenarios = buildDemoBundle().scenarios;
    expect(scenarios.map((item) => item.id))
      .toEqual(["low", "base", "high"]);
    expect(new Set(scenarios.map((item) => item.propensityConcentration)).size).toBe(1);
  });

  it("rejects duplicate scenario IDs and non-monotone exposure factors", () => {
    const duplicate = structuredClone(buildDemoBundle());
    duplicate.scenarios[2].id = "base";
    expect(() => validateFrozenBundle(duplicate))
      .toThrow("exactly one Low, Base, and High");

    const reversed = structuredClone(buildDemoBundle());
    reversed.scenarios[0].movementMultiplier = 1.2;
    expect(() => validateFrozenBundle(reversed))
      .toThrow("exposure multipliers must be monotone");
  });

  it("contains the minimum 30-location Activity Potential cohort", () => {
    expect(buildDemoBundle().activityCohort).toHaveLength(30);
  });

  it("rejects every non-D bundle because production promotion is out of MVP scope", () => {
    const candidate = structuredClone(buildDemoBundle());
    candidate.manifest.synthetic = false;
    candidate.manifest.maximumEvidenceGrade = "C";
    candidate.calibrationReport = {
      heldOutLocations: 3,
      directionalBlocks: 192,
      mdape: 0.36,
      wape: 0.30,
      intervalCoverage: 0.75,
      absoluteSignedWape: 0.10,
      worstEligibleStratumAbsoluteSignedWape: 0.20,
      independentDateReplication: true,
      claimInputsComplete: true,
      insideApplicabilityEnvelope: true,
      downstreamProtocolRegistered: true,
      downstreamValidation: {
        ots: true,
        targetOts: true,
        uniqueReach: false,
        influence: false,
      },
    };
    expect(() => validateFrozenBundle(candidate)).toThrow("MVP runtime accepts Evidence D only");
  });

  it("rejects a target whose universe or qi source is absent", () => {
    const candidate = structuredClone(buildDemoBundle());
    candidate.targets[0].qiSourceId = "missing-source";
    expect(() => validateFrozenBundle(candidate)).toThrow("Dangling target source");
  });

  it("rejects an absent or mis-versioned target-allocation source", () => {
    const absent = structuredClone(buildDemoBundle());
    absent.targetAllocationSourceIds.fmcg = "missing-allocation-source";
    expect(() => validateFrozenBundle(absent))
      .toThrow("Dangling target allocation source");

    const wrongKind = structuredClone(buildDemoBundle());
    const source = wrongKind.sourceManifest.find(
      (item) => item.id === wrongKind.targetAllocationSourceIds.fmcg,
    )!;
    source.kind = "influence";
    expect(() => validateFrozenBundle(wrongKind))
      .toThrow("Incompatible target allocation source");
  });

  it("rejects aggregate target allocation overflow in any scenario", () => {
    const candidate = structuredClone(buildDemoBundle());
    const shares = candidate.sites[0].targetShareBySector.fmcg;
    for (const cellId of Object.keys(shares)) shares[cellId] = 0.34;
    expect(() => validateFrozenBundle(candidate))
      .toThrow("Target shares exceed a probability bound");
  });
});
