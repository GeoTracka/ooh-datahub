-- T5A: governed calibration evidence packages and fail-closed promotion audit.
-- Context-derived T1-T4 facts remain context_only. This schema records the
-- independently reviewed evidence package required before Evidence-C promotion.

CREATE TABLE IF NOT EXISTS ooh_data.calibration_evidence_packages (
  package_digest text PRIMARY KEY CHECK (package_digest ~ '^[0-9a-f]{64}$'),
  package_version text NOT NULL CHECK (package_version = 'calibration-evidence-package-v1'),
  evidence_environment text NOT NULL CHECK (evidence_environment IN ('production_reviewed', 'test_fixture')),
  model_version text NOT NULL CHECK (length(model_version) > 0),
  replay_version text NOT NULL CHECK (length(replay_version) > 0),
  geography_id text NOT NULL CHECK (length(geography_id) > 0),
  applicability_scope text NOT NULL CHECK (length(applicability_scope) > 0),
  context_feature_snapshot_id text NOT NULL
    REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  context_feature_version text NOT NULL CHECK (length(context_feature_version) > 0),
  resolver_version text NOT NULL CHECK (length(resolver_version) > 0),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{32}$'),
  resolution_fingerprint text NOT NULL CHECK (resolution_fingerprint ~ '^[0-9a-f]{32}$'),
  movement_calibration_report jsonb NOT NULL,
  canonical_manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ooh_data.calibration_evidence_artifacts (
  package_digest text NOT NULL
    REFERENCES ooh_data.calibration_evidence_packages (package_digest) ON DELETE RESTRICT,
  artifact_id text NOT NULL CHECK (length(artifact_id) > 0),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_kind text NOT NULL CHECK (evidence_kind IN (
    'movement_truth',
    'exposure_geometry_truth',
    'target_panel_truth',
    'downstream_validation_result'
  )),
  usage_role text NOT NULL CHECK (usage_role IN (
    'training', 'held_out_validation', 'independent_date_replication'
  )),
  provenance_uri text NOT NULL CHECK (length(provenance_uri) > 0),
  retained_uri text NOT NULL CHECK (length(retained_uri) > 0),
  license_id text NOT NULL CHECK (length(license_id) > 0),
  rights_review_ref text NOT NULL CHECK (length(rights_review_ref) > 0),
  commercial_use_status text NOT NULL CHECK (commercial_use_status = 'permitted'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  PRIMARY KEY (package_digest, artifact_id),
  CHECK (period_start <= period_end)
);

CREATE INDEX IF NOT EXISTS calibration_evidence_artifact_sha_idx
  ON ooh_data.calibration_evidence_artifacts (artifact_sha256, usage_role);

CREATE TABLE IF NOT EXISTS ooh_data.calibration_promotion_runs (
  run_id uuid PRIMARY KEY,
  submitted_digest text CHECK (submitted_digest IS NULL OR submitted_digest ~ '^[0-9a-f]{64}$'),
  package_digest text REFERENCES ooh_data.calibration_evidence_packages (package_digest) ON DELETE RESTRICT,
  policy_version text NOT NULL CHECK (policy_version = 'calibration-promotion-policy-v1'),
  evidence_environment text CHECK (evidence_environment IS NULL OR evidence_environment IN ('production_reviewed', 'test_fixture')),
  validation_status text NOT NULL CHECK (validation_status IN ('accepted', 'rejected')),
  package_failure_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  calibration_failure_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  eligible_for_evidence_c boolean NOT NULL DEFAULT false,
  submitted_manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT eligible_for_evidence_c OR validation_status = 'accepted'),
  CHECK (NOT eligible_for_evidence_c OR package_digest IS NOT NULL),
  CHECK (NOT eligible_for_evidence_c OR evidence_environment = 'production_reviewed'),
  CHECK (
    (validation_status = 'accepted' AND cardinality(package_failure_codes) = 0)
    OR validation_status = 'rejected'
  )
);

CREATE INDEX IF NOT EXISTS calibration_promotion_runs_digest_idx
  ON ooh_data.calibration_promotion_runs (submitted_digest, created_at DESC);

CREATE OR REPLACE FUNCTION ooh_data.validate_calibration_context_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  context_row ooh_data.context_feature_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO context_row
  FROM ooh_data.context_feature_snapshots
  WHERE snapshot_id = NEW.context_feature_snapshot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CALIBRATION_CONTEXT_SNAPSHOT_NOT_FOUND:%', NEW.context_feature_snapshot_id;
  END IF;

  IF context_row.feature_version IS DISTINCT FROM NEW.context_feature_version
     OR context_row.resolver_version IS DISTINCT FROM NEW.resolver_version
     OR context_row.source_fingerprint IS DISTINCT FROM NEW.source_fingerprint
     OR context_row.resolution_fingerprint IS DISTINCT FROM NEW.resolution_fingerprint THEN
    RAISE EXCEPTION 'CALIBRATION_CONTEXT_BINDING_MISMATCH:%', NEW.context_feature_snapshot_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS calibration_context_binding_guard
  ON ooh_data.calibration_evidence_packages;
CREATE TRIGGER calibration_context_binding_guard
BEFORE INSERT ON ooh_data.calibration_evidence_packages
FOR EACH ROW
EXECUTE FUNCTION ooh_data.validate_calibration_context_binding();

CREATE OR REPLACE FUNCTION ooh_data.reject_calibration_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'CALIBRATION_EVIDENCE_IMMUTABLE:%', TG_TABLE_NAME;
END;
$function$;

DROP TRIGGER IF EXISTS calibration_evidence_packages_immutable
  ON ooh_data.calibration_evidence_packages;
CREATE TRIGGER calibration_evidence_packages_immutable
BEFORE UPDATE OR DELETE ON ooh_data.calibration_evidence_packages
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_calibration_evidence_mutation();

DROP TRIGGER IF EXISTS calibration_evidence_artifacts_immutable
  ON ooh_data.calibration_evidence_artifacts;
CREATE TRIGGER calibration_evidence_artifacts_immutable
BEFORE UPDATE OR DELETE ON ooh_data.calibration_evidence_artifacts
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_calibration_evidence_mutation();

DROP TRIGGER IF EXISTS calibration_promotion_runs_immutable
  ON ooh_data.calibration_promotion_runs;
CREATE TRIGGER calibration_promotion_runs_immutable
BEFORE UPDATE OR DELETE ON ooh_data.calibration_promotion_runs
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_calibration_evidence_mutation();
