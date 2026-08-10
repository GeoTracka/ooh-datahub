CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ooh_data.site_vector_context_runs
  ALTER COLUMN source_manifest DROP NOT NULL,
  ALTER COLUMN input_fingerprint DROP NOT NULL;

ALTER TABLE ooh_data.site_vector_context_runs
  DROP CONSTRAINT IF EXISTS site_vector_context_runs_success_lineage_check;
ALTER TABLE ooh_data.site_vector_context_runs
  ADD CONSTRAINT site_vector_context_runs_success_lineage_check
  CHECK (
    status <> 'succeeded'
    OR (
      source_manifest IS NOT NULL
      AND input_fingerprint IS NOT NULL
      AND snapshot_id IS NOT NULL
      AND completed_at IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION ooh_data.reject_overture_normalized_feature_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'OVERTURE_NORMALIZED_FEATURE_IMMUTABLE:%:%:%',
    OLD.source_id, OLD.artifact_sha256, OLD.feature_id;
END;
$function$;

DROP TRIGGER IF EXISTS overture_place_feature_immutable ON ooh_data.overture_place_features;
CREATE TRIGGER overture_place_feature_immutable
BEFORE UPDATE OR DELETE ON ooh_data.overture_place_features
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_overture_normalized_feature_mutation();

DROP TRIGGER IF EXISTS overture_road_feature_immutable ON ooh_data.overture_road_segments;
CREATE TRIGGER overture_road_feature_immutable
BEFORE UPDATE OR DELETE ON ooh_data.overture_road_segments
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_overture_normalized_feature_mutation();
