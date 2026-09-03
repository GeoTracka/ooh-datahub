# Governed calibration evidence and movement verification (T5A/T5B)

T5A/T5B form the repository-side promotion boundary between the existing Evidence-D/context foundation and any future production Evidence-C movement/OTS/reach claims. They make calibration evidence auditable, checksum-bound and semantically recomputable; they do **not** create missing field evidence and do not promote the current seeded demo.

## Core rule

A favorable calibration metrics object is not sufficient evidence.

Evidence-C movement eligibility requires all of the following:

1. a structurally valid `calibration-evidence-package-v1`;
2. locally checksum-verified evidence artifacts;
3. an exact binding to one immutable T4 `context_feature_snapshots` row, including source and resolution fingerprints;
4. explicit fitting movement evidence plus separate held-out movement, exposure-geometry, target/panel and downstream-validation evidence;
5. independent-date movement evidence whose period begins after the declared model/threshold freeze;
6. no source artifact revision reused across fitting, held-out or independent-date roles;
7. a pre-registered `movement-calibration-protocol-v1` and valid `movement-calibration-evaluation-v1` block records;
8. a declared movement report that exactly matches the report recomputed from those governed records;
9. an exact `movement-calibration-gate-v1` binding and a passing result from the existing `evaluateMovementCalibration()` threshold authority;
10. `evidenceEnvironment='production_reviewed'`.

`test_fixture` packages can exercise the package machinery but are always `TEST_FIXTURE_NOT_PROMOTABLE`.

## Package contract

The package contains:

- package/model/replay versions;
- `movementCalibrationGateVersion` and `modelFrozenAt` so independent-date replication cannot be silently re-labelled from pre-freeze observations;
- geography and applicability scope;
- exact T4 context snapshot ID, feature/resolver versions and source/resolution fingerprints;
- evidence artifacts with immutable SHA-256, kind, usage role, collection period, provenance URI, retained URI, license, rights-review reference and explicit commercial-use permission;
- the movement calibration report consumed by the existing calibration gate.

Artifact array order does not affect the package digest. Local file paths are deliberately **not** part of the package: the same retained evidence must have the same digest regardless of the machine on which it is verified.

T4 snapshot and derived feature rows are immutable. Corrections therefore require a new feature version/snapshot instead of changing the provenance anchor of an already registered calibration package.

## T5B movement-evaluation contract

For `production_reviewed` movement evidence, the three `movement_truth` artifact roles are parsed rather than treated as opaque files:

- `training` contains primary fitting-location blocks;
- `held_out_validation` contains primary whole-location holdout blocks and must carry P10/P50/P90 predictions;
- `independent_date_replication` contains second-date blocks after `modelFrozenAt`; held-out rows in this artifact must also carry P10/P50/P90 predictions.

Every file carries the same pre-registered protocol. Version 1 intentionally fixes ambiguous statistical choices instead of allowing runtime discretion:

- low-count handling is `none`; records are not silently dropped;
- denominators use all included held-out blocks;
- individual exclusions must be named by record ID with a pre-registration reference;
- road-class/daypart applicability exclusions must be explicit and referenced;
- eligible road-class and daypart bias strata use the normative minimum of 8 held-out blocks;
- the protocol freeze must pre-date observed validation records.

The evaluator also enforces whole-location splitting: one location cannot appear as both `training` and `held_out`.

### Derived gate inputs

The following values are recomputed from included governed records:

- `heldOutLocations`: distinct held-out locations;
- `directionalBlocks`: all included primary + independent-date pilot directional blocks;
- `mdape`: median `abs(P50-observed)/observed`, only where observed > 0;
- `wape`: `sum(abs(P50-observed))/sum(observed)` over all held-out blocks;
- `intervalCoverage`: fraction of held-out observations inside inclusive `[P10,P90]`;
- `absoluteSignedWape`: `abs(sum(P50-observed)/sum(observed))`;
- `worstEligibleStratumAbsoluteSignedWape`: worst absolute signed-WAPE among separately evaluated road-class and daypart strata with at least 8 included held-out blocks;
- `independentDateReplication`: every included primary location × day-type × daypart × count-direction × split cell has an included matching post-freeze independent-date cell.

Zero total observed volume never becomes a favorable percentage. A zero held-out denominator or zero-total eligible bias stratum fails semantic verification. P10/P90 boundaries are inclusive.

`claimInputsComplete`, `insideApplicabilityEnvelope` and `downstreamProtocolRegistered` remain governed declarations because they depend on evidence outside the movement-count arithmetic. They are still part of the package digest and the existing numeric gate.

A production package whose declared movement report differs from the derived report is rejected with `DECLARED_REPORT_MISMATCH`; a favorable hand-authored summary therefore cannot override worse raw validation records.

## Offline checksum + semantic verification

Create a local manifest envelope:

```json
{
  "package": {
    "packageVersion": "calibration-evidence-package-v1",
    "movementCalibrationGateVersion": "movement-calibration-gate-v1",
    "evidenceEnvironment": "production_reviewed",
    "modelVersion": "movement-model-v2",
    "replayVersion": "movement-replay-v2",
    "modelFrozenAt": "2026-01-31T23:59:59Z",
    "geographyId": "nga-lagos",
    "applicabilityScope": "reviewed scope",
    "contextBinding": {
      "snapshotId": "context:...",
      "featureVersion": "planner-context-v1",
      "resolverVersion": "entity-resolver-v1",
      "sourceFingerprint": "<32 lowercase hex>",
      "resolutionFingerprint": "<32 lowercase hex>"
    },
    "artifacts": [],
    "movementCalibrationReport": {}
  },
  "artifactFiles": {
    "movement-training": "./evidence/movement-training.json",
    "movement-holdout": "./evidence/movement-holdout.json",
    "movement-replication": "./evidence/movement-replication.json"
  }
}
```

The abbreviated object documents the envelope shape only; the package schema requires all evidence roles and calibration fields.

Run:

```bash
pnpm calibration:validate --manifest=./calibration-package.json
```

The command first verifies every mapped artifact byte against its declared SHA-256. Only after those hashes pass does a production package parse the governed movement records, derive a path-independent `movementEvaluationDigest`, compare the derived report to the declared report, and apply `movement-calibration-gate-v1`.

The generic in-memory `evaluateCalibrationPromotion()` path is intentionally fail-closed for production packages and returns `MOVEMENT_EVALUATION_NOT_VERIFIED`; production eligibility is only surfaced after semantic evaluation of checksum-verified records.

## Registration and audit

With `DATABASE_URL` configured:

```bash
pnpm calibration:register --manifest=./calibration-package.json
```

Registration:

- migrates the database first;
- refuses package registration when local artifact bytes do not match their declared hashes;
- refuses a production package whose movement records/protocol/report fail semantic verification;
- checks the T4 snapshot binding in PostgreSQL;
- inserts package/artifact rows idempotently by package digest;
- records every accepted or rejected attempt in `calibration_promotion_runs` with the exact movement-gate version, movement-evaluation version/digest, report-verification state and separate package/artifact/evaluation/promotion/calibration reason codes;
- cross-checks promotion-run package digest, evidence environment and movement-gate version against the referenced package;
- makes T4 snapshot/features, package, artifact and decision history immutable.

A revised artifact, model freeze, rights review or other governed package field changes the package digest and therefore creates a new evidence package rather than editing history.

## Evidence boundary

T1–T4 historical observations and E1–E3 spatial context remain `context_only`. They may be inputs to model development, but they cannot fill missing held-out truth, manufacture calibration metrics, or change evidence grade by volume alone.

The current planner's seeded Evidence-D behavior remains unchanged. T5A/T5B provide a safe verification path for future independently reviewed evidence. Issue #41 remains open until real field evidence exists and passes the governed package, semantic evaluation and existing calibration gate.
