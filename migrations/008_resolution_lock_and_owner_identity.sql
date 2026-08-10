CREATE OR REPLACE FUNCTION ooh_data.lock_source_observation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('ooh-datahub:source-observations', 0)
  );

  IF EXISTS (
    SELECT 1
    FROM ooh_data.resolution_runs
    WHERE run_kind = 'rebuild'
      AND status = 'running'
  ) THEN
    RAISE EXCEPTION 'SOURCE_MUTATION_BLOCKED_BY_ACTIVE_RESOLUTION';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION ooh_data.lock_resolution_source_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.run_kind = 'rebuild' AND NEW.status = 'running' THEN
    -- Wait for every source-observation mutation transaction that began before
    -- this resolution run, then publish the running row. Future source writes
    -- fail closed until the run reaches a terminal state.
    PERFORM pg_advisory_xact_lock(
      hashtextextended('ooh-datahub:source-observations', 0)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS resolution_source_snapshot_lock ON ooh_data.resolution_runs;
CREATE TRIGGER resolution_source_snapshot_lock
BEFORE INSERT ON ooh_data.resolution_runs
FOR EACH ROW
WHEN (NEW.run_kind = 'rebuild' AND NEW.status = 'running')
EXECUTE FUNCTION ooh_data.lock_resolution_source_snapshot();

-- Keep the original public column name for importer compatibility. The stable
-- owner identity is namespace + normalized owner name; per-assertion revisions
-- remain on aliases/assertions rather than creating a new owner for each file revision.
ALTER TABLE ooh_data.media_owner_entities
  RENAME COLUMN first_registry_revision TO registry_revision;

ALTER TABLE ooh_data.media_owner_entities
  DROP COLUMN last_registry_revision;

CREATE OR REPLACE FUNCTION ooh_data.skip_existing_stable_media_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ooh_data.media_owner_entities e
    WHERE e.registry_namespace = NEW.registry_namespace
      AND e.normalized_key = NEW.normalized_key
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stable_media_owner_insert_guard ON ooh_data.media_owner_entities;
CREATE TRIGGER stable_media_owner_insert_guard
BEFORE INSERT ON ooh_data.media_owner_entities
FOR EACH ROW
EXECUTE FUNCTION ooh_data.skip_existing_stable_media_owner();

CREATE OR REPLACE FUNCTION ooh_data.correct_resolution_run_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  distinct_site_count bigint;
BEGIN
  IF NEW.run_kind = 'rebuild' AND NEW.status = 'succeeded' THEN
    SELECT count(*)
    INTO distinct_site_count
    FROM ooh_data.site_entities
    WHERE resolver_version = NEW.resolver_version;

    NEW.counts := jsonb_set(
      COALESCE(NEW.counts, '{}'::jsonb),
      '{siteEntities}',
      to_jsonb(distinct_site_count),
      true
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS resolution_run_count_correction ON ooh_data.resolution_runs;
CREATE TRIGGER resolution_run_count_correction
BEFORE UPDATE OF status, counts ON ooh_data.resolution_runs
FOR EACH ROW
WHEN (NEW.run_kind = 'rebuild' AND NEW.status = 'succeeded')
EXECUTE FUNCTION ooh_data.correct_resolution_run_counts();
