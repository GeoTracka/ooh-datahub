# Governed calibration evidence package (T5A)

T5A is the repository-side promotion boundary between the existing Evidence-D/context foundation and any future production Evidence-C movement/OTS/reach claims. It makes calibration evidence auditable and checksum-bound; it does **not** create the missing field evidence and does not promote the current seeded demo.

## Core rule

A favorable calibration metrics object is not sufficient evidence.

Evidence-C eligibility requires all of the following:

1. a structurally valid `calibration-evidence-package-v1`;
2. locally checksum-verified evidence artifacts;
3. an exact binding to one immutable T4 `context_feature_snapshots` row, including source and resolution fingerprints;
4. separate held-out movement, exposure-geometry, target/panel and downstream-validation evidence;
5. independent-date movement evidence when the calibration report claims replication;
6. no source artifact revision reused as both training and held-out/independent validation;
7. a passing result from the existing `evaluateMovementCalibration()` threshold authority;
8. `evidenceEnvironment='production_reviewed'`.

`test_fixture` packages can exercise the exact same contract but are always `TEST_FIXTURE_NOT_PROMOTABLE`.

## Package contract

The package contains:

- package/model/replay versions;
- geography and applicability scope;
- exact T4 context snapshot ID, feature/resolver versions and source/resolution fingerprints;
- evidence artifacts with immutable SHA-256, kind, usage role, collection period, provenance URI, retained URI, license, rights-review reference and explicit commercial-use permission;
- the movement calibration report consumed by the existing calibration gate.

Artifact array order does not affect the package digest. Local file paths are deliberately **not** part of the package: the same retained evidence must have the same digest regardless of the machine on which it is verified.

## Offline checksum verification

Create a local manifest envelope:

```json
{
  "package": {
    "packageVersion": "calibration-evidence-package-v1",
    "evidenceEnvironment": "test_fixture",
    "modelVersion": "movement-model-v2",
    "replayVersion": "movement-replay-v2",
    "geographyId": "nga-lagos",
    "applicabilityScope": "fixture only",
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
    "movement-holdout": "./evidence/movement-holdout.json"
  }
}
```

The abbreviated object above documents the envelope shape only; the package schema requires all evidence roles and calibration fields.

Run:

```bash
pnpm calibration:validate --manifest=./calibration-package.json
```

The command hashes every mapped local file and compares it with the package SHA-256 before reporting `registerable=true`. A structurally valid test fixture may be registerable while still reporting `eligibleForEvidenceC=false`.

## Registration and audit

With `DATABASE_URL` configured:

```bash
pnpm calibration:register --manifest=./calibration-package.json
```

Registration:

- migrates the database first;
- refuses package registration when local artifact bytes do not match their declared hashes;
- checks the T4 snapshot binding in PostgreSQL;
- inserts package/artifact rows idempotently by package digest;
- records every accepted or rejected attempt in `calibration_promotion_runs` with separate package, artifact, promotion-policy and numeric-calibration reason codes;
- makes package, artifact and decision history immutable.

A revised artifact changes the package digest and therefore creates a new evidence package rather than editing history.

## Evidence boundary

T1–T4 historical observations and E1–E3 spatial context remain `context_only`. They may be inputs to model development, but they cannot fill missing held-out truth, manufacture calibration metrics, or change evidence grade by volume alone.

The current planner's seeded Evidence-D behavior remains unchanged. T5A only provides a safe path for a future independently reviewed package. Issue #41 remains open until real field evidence exists and passes this contract plus the existing calibration gate.
