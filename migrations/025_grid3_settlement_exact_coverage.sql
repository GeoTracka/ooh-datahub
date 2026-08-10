CREATE TABLE IF NOT EXISTS ooh_data.grid3_settlement_coverage (
  source_id text NOT NULL CHECK (source_id = 'grid3-nigeria-settlements'),
  artifact_sha256 text NOT NULL,
  coverage_geometry_fingerprint text NOT NULL CHECK (coverage_geometry_fingerprint ~ '^[0-9a-f]{64}$'),
  coverage_evidence_sha256 text NOT NULL CHECK (coverage_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  coverage_reference text NOT NULL CHECK (coverage_reference <> ''),
  coverage_storage_uri text NOT NULL CHECK (coverage_storage_uri <> ''),
  geom geometry(MultiPolygon, 4326) NOT NULL CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom)),
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS grid3_settlement_coverage_geom_idx
  ON ooh_data.grid3_settlement_coverage USING gist (geom);

CREATE OR REPLACE FUNCTION ooh_data.guard_grid3_settlement_coverage_replay()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing ooh_data.grid3_settlement_coverage%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM ooh_data.grid3_settlement_coverage
  WHERE source_id=NEW.source_id AND artifact_sha256=NEW.artifact_sha256;
  IF FOUND THEN
    IF (to_jsonb(existing) - 'first_enrichment_run_id')
       IS DISTINCT FROM (to_jsonb(NEW) - 'first_enrichment_run_id') THEN
      RAISE EXCEPTION 'GRID3_SETTLEMENT_COVERAGE_REPLAY_DRIFT:%', NEW.artifact_sha256;
    END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS grid3_settlement_coverage_replay_guard ON ooh_data.grid3_settlement_coverage;
CREATE TRIGGER grid3_settlement_coverage_replay_guard
BEFORE INSERT ON ooh_data.grid3_settlement_coverage
FOR EACH ROW EXECUTE FUNCTION ooh_data.guard_grid3_settlement_coverage_replay();

DROP TRIGGER IF EXISTS grid3_settlement_coverage_immutable ON ooh_data.grid3_settlement_coverage;
CREATE TRIGGER grid3_settlement_coverage_immutable
BEFORE UPDATE OR DELETE ON ooh_data.grid3_settlement_coverage
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_settlement_context_mutation();

CREATE OR REPLACE FUNCTION ooh_data.validate_grid3_settlement_snapshot_source()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  product_role text;
  product_version text;
  artifact_field_map_fingerprint text;
  license_id_value text;
  commercial_status text;
  license_review jsonb;
BEGIN
  SELECT
    a.metadata->>'grid3ProductRole',
    a.metadata->>'productVersion',
    a.metadata->>'fieldMapFingerprint',
    a.license_id,
    a.commercial_use_status,
    a.metadata->'licenseReview'
  INTO
    product_role, product_version, artifact_field_map_fingerprint,
    license_id_value, commercial_status, license_review
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=NEW.settlement_source_id
    AND a.artifact_sha256=NEW.settlement_artifact_sha256;

  IF product_role IS DISTINCT FROM 'settlement_extents'
     OR product_version IS DISTINCT FROM 'v4.1' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_ARTIFACT_ROLE_OR_VERSION_MISMATCH:%:%', product_role, product_version;
  END IF;
  IF artifact_field_map_fingerprint IS NULL
     OR artifact_field_map_fingerprint <> NEW.field_map_fingerprint THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_FIELD_MAP_FINGERPRINT_MISMATCH';
  END IF;
  IF commercial_status IS DISTINCT FROM 'permitted'
     OR license_id_value IS NULL
     OR license_id_value = ''
     OR license_id_value LIKE '%REVIEW%'
     OR license_id_value LIKE '%UNKNOWN%'
     OR jsonb_typeof(license_review) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_LICENSE_REVIEW_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.grid3_settlement_coverage c
    WHERE c.source_id=NEW.settlement_source_id
      AND c.artifact_sha256=NEW.settlement_artifact_sha256
      AND c.decision_use='context_only'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_EXACT_COVERAGE_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.enrichment_runs r
    WHERE r.source_id=NEW.settlement_source_id
      AND r.artifact_sha256=NEW.settlement_artifact_sha256
      AND r.adapter_version='grid3-settlement-adapter-v1'
      AND r.status='succeeded'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_IMPORT_NOT_READY';
  END IF;
  RETURN NEW;
END;
$function$;
