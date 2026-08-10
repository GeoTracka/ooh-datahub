CREATE OR REPLACE FUNCTION ooh_data.require_osm_advertising_artifact_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.source_id = 'osm-geofabrik-nigeria' AND NOT EXISTS (
    SELECT 1
    FROM ooh_data.enrichment_artifact_derivations d
    WHERE d.child_source_id = NEW.source_id
      AND d.child_artifact_sha256 = NEW.artifact_sha256
      AND d.parent_source_id = 'osm-geofabrik-nigeria'
      AND d.transform_id = 'osmium-advertising-reduction'
  ) THEN
    RAISE EXCEPTION 'OSM_ADVERTISING_DERIVATION_LINEAGE_REQUIRED:%', NEW.artifact_sha256;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS osm_advertising_artifact_lineage_guard
  ON ooh_data.osm_advertising_candidates;
CREATE TRIGGER osm_advertising_artifact_lineage_guard
BEFORE INSERT ON ooh_data.osm_advertising_candidates
FOR EACH ROW
EXECUTE FUNCTION ooh_data.require_osm_advertising_artifact_lineage();
