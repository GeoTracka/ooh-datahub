-- T5A prerequisite hardening: calibration packages bind to exact T4 context
-- snapshot/fingerprint evidence. That binding is not reproducible if a T4
-- snapshot or its governed feature rows can be rewritten after derivation.
-- Derivation already uses deterministic inserts / ON CONFLICT DO NOTHING, so
-- corrections must create a new feature version/snapshot rather than mutate history.

CREATE OR REPLACE FUNCTION ooh_data.reject_context_feature_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'CONTEXT_FEATURE_IMMUTABLE:%', TG_TABLE_NAME;
END;
$function$;

DROP TRIGGER IF EXISTS context_feature_snapshots_immutable
  ON ooh_data.context_feature_snapshots;
CREATE TRIGGER context_feature_snapshots_immutable
BEFORE UPDATE OR DELETE ON ooh_data.context_feature_snapshots
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();

DROP TRIGGER IF EXISTS ooh_source_rate_benchmarks_immutable
  ON ooh_data.ooh_source_rate_benchmarks;
CREATE TRIGGER ooh_source_rate_benchmarks_immutable
BEFORE UPDATE OR DELETE ON ooh_data.ooh_source_rate_benchmarks
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();

DROP TRIGGER IF EXISTS ooh_entity_activity_context_immutable
  ON ooh_data.ooh_entity_activity_context;
CREATE TRIGGER ooh_entity_activity_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.ooh_entity_activity_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();

DROP TRIGGER IF EXISTS ooh_period_coverage_context_immutable
  ON ooh_data.ooh_period_coverage_context;
CREATE TRIGGER ooh_period_coverage_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.ooh_period_coverage_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();

DROP TRIGGER IF EXISTS faan_airport_activity_context_immutable
  ON ooh_data.faan_airport_activity_context;
CREATE TRIGGER faan_airport_activity_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.faan_airport_activity_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();

DROP TRIGGER IF EXISTS faan_resolution_coverage_context_immutable
  ON ooh_data.faan_resolution_coverage_context;
CREATE TRIGGER faan_resolution_coverage_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.faan_resolution_coverage_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_context_feature_mutation();
