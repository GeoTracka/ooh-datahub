-- E3 audit hardening: E2B1/E2B2 already reject mutation of governed derived
-- context, but E2A vector snapshots/context remained updateable. Exact snapshot
-- provenance is only meaningful if those rows are immutable after insertion.
CREATE OR REPLACE FUNCTION ooh_data.reject_vector_context_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'VECTOR_CONTEXT_IMMUTABLE:%', TG_TABLE_NAME;
END;
$function$;

DROP TRIGGER IF EXISTS site_vector_context_snapshot_immutable
  ON ooh_data.site_vector_context_snapshots;
CREATE TRIGGER site_vector_context_snapshot_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_vector_context_snapshots
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_vector_context_mutation();

DROP TRIGGER IF EXISTS site_vector_context_coverage_immutable
  ON ooh_data.site_vector_context_coverage;
CREATE TRIGGER site_vector_context_coverage_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_vector_context_coverage
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_vector_context_mutation();

DROP TRIGGER IF EXISTS site_destination_context_immutable
  ON ooh_data.site_destination_context;
CREATE TRIGGER site_destination_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_destination_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_vector_context_mutation();

DROP TRIGGER IF EXISTS site_network_context_immutable
  ON ooh_data.site_network_context;
CREATE TRIGGER site_network_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_network_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_vector_context_mutation();
