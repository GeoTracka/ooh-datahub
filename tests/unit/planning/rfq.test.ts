import { describe, expect, it } from "vitest";
import { applyUploadContextToPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { PlanningResult } from "@/contracts/domain";
import { buildInternalDownload, generateRfq } from "@/planning/rfq";
import { deterministicReview, seededFmcgPlan as plan } from "../../fixtures/seededPlans";

describe("generateRfq", () => {
  const rejectedCases: Array<[string, PlanningResult, unknown]> = [
    ["PACKAGE_INVALID", { ...plan, recommended: { ...plan.recommended, valid: false } } as unknown as PlanningResult, deterministicReview],
    ["FLIGHT_DATES_NOT_CONFIRMED", plan, { ...deterministicReview, datesConfirmed: false }],
    ["FLIGHT_DATE_ORDER_INVALID", plan, { ...deterministicReview, flightEnd: "2026-08-01" }],
  ];

  it.each(rejectedCases)("rejects %s", (code, candidate, review) => {
    expect(() => generateRfq(bundle, candidate, review)).toThrow(String(code));
  });

  it("rejects stale applied IDs/fingerprints and notes for an inactive supplier", () => {
    const stale = {
      ...plan,
      recommended: { ...plan.recommended, estimateFingerprint: "stale" },
    };
    expect(() => generateRfq(bundle, stale, deterministicReview))
      .toThrow("STALE_APPLIED_PLAN");
    const staleReplay = {
      ...plan,
      replay: { ...plan.replay!, exposurePlanFingerprint: "stale-replay" },
    };
    expect(() => generateRfq(bundle, staleReplay, deterministicReview))
      .toThrow("STALE_APPLIED_PLAN");
    expect(() => generateRfq(bundle, plan, {
      ...deterministicReview,
      supplierNotes: { "supplier-not-selected": "Do not leak this" },
    })).toThrow("UNKNOWN_SUPPLIER_NOTE");
  });

  it.each([
    { ...deterministicReview, buyerContact: { name: "D", email: "bad" } },
    { ...deterministicReview, responseDeadline: "2026-09-01" },
  ])("rejects invalid contact or deadline review input", (review) => {
    expect(() => generateRfq(bundle, plan, review)).toThrow();
  });

  it("contains every campaign field, selected line, verification request and replay value", () => {
    const rfq = generateRfq(bundle, plan, deterministicReview);
    expect(rfq.internalRequest.campaign).toMatchObject({
      product: { name: "Demo Spark" },
      sector: "fmcg",
      objective: "broad_reach",
      targetAudience: plan.brief.targetAudience,
      flight: { start: "2026-09-01", end: "2026-09-28", datesConfirmed: true },
      responseDeadline: "2026-08-20",
    });
    expect(rfq.internalRequest.lines.map((line) => line.faceId).sort())
      .toEqual([...plan.recommended.siteIds].sort());
    expect(rfq.internalRequest.audiencePlanningBasis).toMatchObject({
      targetDefinition: expect.any(String),
      targetUniverse: plan.measurement!.claim.kind === "scenario_target_reach"
        ? plan.measurement!.claim.universe
        : null,
      modelVersion: bundle.manifest.modelVersion,
      targetUniverseVersion: bundle.manifest.targetUniverseVersion,
      intervalType: "scenario",
      estimateValidity: "EXACT_APPLIED_PLAN",
      contextRevision: null,
    });
    expect(rfq.internalRequest.audiencePlanningBasis.targetReachSharePercent)
      .not.toBeNull();
    expect(rfq.internalRequest.audiencePlanningBasis.priorityInfluenceArchetypes)
      .toEqual([...rfq.internalRequest.audiencePlanningBasis.priorityInfluenceArchetypes].sort());
    for (const line of rfq.internalRequest.lines) {
      expect(line).toMatchObject({
        supplierId: expect.any(String),
        ownerSeller: expect.any(String),
        assetId: line.faceId,
        structureId: null,
        address: expect.any(String),
        coordinate: { longitude: expect.any(Number), latitude: expect.any(Number) },
        dimensions: null,
        requestedSchedule: { quantity: 1 },
        indicativeRate: { currency: "NGN", basis: "illustrative_demo_line_rate" },
      });
    }
    expect(rfq.internalRequest.lines.every((line) =>
      Object.values(line.confirmationRequests).every((value) => value === "REQUESTED")
    )).toBe(true);
    expect(buildInternalDownload(rfq)).toContain(plan.replay!.bundleId);
    expect(buildInternalDownload(rfq)).toContain(plan.replay!.modelVersion);
  });

  it("isolates supplier copy from internal budget, audience, replay and other suppliers", () => {
    const supplierIds = [...new Set(plan.recommended.siteIds.map((siteId) =>
      bundle.sites.find((site) => site.id === siteId)!.supplierId
    ))].sort();
    const notes = Object.fromEntries(supplierIds.map((id, index) => [
      id,
      "Private supplier note " + index,
    ]));
    const rfq = generateRfq(bundle, plan, {
      ...deterministicReview,
      supplierNotes: notes,
    });
    for (const message of rfq.supplierMessages) {
      const otherIds = rfq.internalRequest.lines
        .filter((line) => line.supplierId !== message.supplierId)
        .map((line) => line.faceId);
      const otherAddresses = rfq.internalRequest.lines
        .filter((line) => line.supplierId !== message.supplierId)
        .map((line) => line.address);
      expect(message.lines.every((line) => line.supplierId === message.supplierId)).toBe(true);
      for (const line of message.lines) {
        expect(message.body).toContain(line.assetId);
        expect(message.body).toContain(line.address);
        expect(message.body).toContain(String(line.coordinate.latitude));
        expect(message.body).toContain(line.indicativeRate.basis);
      }
      expect(otherIds.every((id) => !message.body.includes(id))).toBe(true);
      expect(otherAddresses.every((address) => !message.body.includes(address))).toBe(true);
      expect(message.body).toContain(notes[message.supplierId]);
      expect(Object.entries(notes).filter(([id]) => id !== message.supplierId)
        .every(([, note]) => !message.body.includes(note))).toBe(true);
      expect(message.body).not.toContain(String(plan.brief.budgetNgn));
      expect(message.body).not.toMatch(/Influence Capture|exposurePlanFingerprint|panelVersion/i);
    }
  });

  it("invalidates internal numeric estimates when reviewed dates change", () => {
    const rfq = generateRfq(bundle, plan, {
      ...deterministicReview,
      flightStart: "2026-09-08",
    });
    expect(rfq.internalRequest.audiencePlanningBasis.estimateValidity)
      .toBe("RFQ_SCHEDULE_REQUIRES_RECOMPUTE");
    expect(rfq.internalRequest.audiencePlanningBasis.targetReach).toBeNull();
  });

  it("keeps a valid context shortlist generatable with audience estimates unavailable", () => {
    const context = {
      ...plan,
      recommended: {
        ...plan.recommended,
        mode: "context_shortlist" as const,
        planningFit: null,
        pillars: null,
      },
    };
    expect(generateRfq(bundle, context, deterministicReview)
      .internalRequest.audiencePlanningBasis.estimateValidity)
      .toBe("CONTEXT_SHORTLIST_ONLY");
  });

  it("keeps applied upload provenance internal without changing seeded delivery claims", () => {
    const applied = applyUploadContextToPlan(bundle, plan, {
      mode: "context_shortlist" as const,
      decisionUse: "context_only" as const,
      selectedRowIds: ["UP-001"],
      selectedRows: [],
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
      fingerprint: "test-context-fingerprint",
      claimResolution: {
        highest: "context" as const,
        influenceEligible: false,
        evidenceCap: "D" as const,
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
        recoveryAction: "Provide a feature-compatible calibration bundle",
      },
      planningFit: null,
    });
    expect(applied.measurement!.fingerprint).toBe(plan.measurement!.fingerprint);
    expect(applied.dataRevision).toBe("upload-context-v1");
    expect(applied.contextRevision?.enrichmentSnapshotId).toBe("snapshot-upload-1");
    const rfq = generateRfq(bundle, applied, deterministicReview);
    expect(rfq.internalRequest.audiencePlanningBasis).toMatchObject({
      estimateValidity: "EXACT_APPLIED_PLAN",
      contextRevision: {
        enrichmentSnapshotId: "snapshot-upload-1",
        dataRevision: "upload-context-v1",
        decisionUse: "context_only",
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
      },
    });
    const supplierCopy = JSON.stringify(rfq.supplierMessages);
    expect(supplierCopy).not.toContain("snapshot-upload-1");
    expect(supplierCopy).not.toContain("upload-context-v1");
  });

  it("is deterministic, watermarked, and contains no transactional guarantee", () => {
    const first = generateRfq(bundle, plan, deterministicReview);
    const second = generateRfq(bundle, plan, deterministicReview);
    expect(first).toEqual(second);
    const text = JSON.stringify(first);
    expect(text).toContain("DEMO — DO NOT SEND");
    expect(text).not.toMatch(/\b(booked|reserved|sent|guaranteed)\b/i);
  });
});
