CREATE OR REPLACE FUNCTION ooh_data.lock_source_observation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('ooh-datahub:source-observations', 0)
  );
  RETURN NULL;
END;
$function$;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ooh_observations',
    'ooh_board_quality_observations',
    'faan_monthly_observations',
    'faan_annual_observations'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS source_observation_mutation_lock ON ooh_data.%I',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER source_observation_mutation_lock BEFORE INSERT OR UPDATE OR DELETE ON ooh_data.%I FOR EACH STATEMENT EXECUTE FUNCTION ooh_data.lock_source_observation_mutation()',
      table_name
    );
  END LOOP;
END;
$triggers$;

ALTER TABLE ooh_data.media_owner_entities
  RENAME COLUMN registry_revision TO first_registry_revision;

ALTER TABLE ooh_data.media_owner_entities
  ADD COLUMN last_registry_revision text;

UPDATE ooh_data.media_owner_entities
SET last_registry_revision = first_registry_revision
WHERE last_registry_revision IS NULL;

ALTER TABLE ooh_data.media_owner_entities
  ALTER COLUMN last_registry_revision SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_owner_entities_stable_registry_key_idx
  ON ooh_data.media_owner_entities (registry_namespace, normalized_key);

ALTER TABLE ooh_data.site_coordinate_assertions
  DROP CONSTRAINT IF EXISTS site_coordinate_assertions_source_rights_alignment_check;

ALTER TABLE ooh_data.site_coordinate_assertions
  ADD CONSTRAINT site_coordinate_assertions_source_rights_alignment_check
  CHECK (
    (spatial_rights = 'customer_captured' AND source_kind IN ('customer_capture', 'field_survey'))
    OR (spatial_rights = 'open_licensed' AND source_kind = 'open_dataset')
    OR (spatial_rights = 'provider_derived' AND source_kind = 'licensed_provider')
    OR (spatial_rights = 'unknown' AND assertion_status <> 'approved')
  );
