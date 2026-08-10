CREATE OR REPLACE FUNCTION ooh_data.guard_population_radius_replay_drift()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing ooh_data.site_population_radius_context%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM ooh_data.site_population_radius_context
  WHERE snapshot_id=NEW.snapshot_id
    AND site_id=NEW.site_id
    AND coordinate_assertion_id=NEW.coordinate_assertion_id
    AND radius_m=NEW.radius_m;

  IF FOUND AND to_jsonb(existing) IS DISTINCT FROM to_jsonb(NEW) THEN
    RAISE EXCEPTION 'RASTER_CONTEXT_REPLAY_DRIFT:site_population_radius_context:%:%:%:%',
      NEW.snapshot_id, NEW.site_id, NEW.coordinate_assertion_id, NEW.radius_m;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS population_radius_replay_drift_guard
  ON ooh_data.site_population_radius_context;
CREATE TRIGGER population_radius_replay_drift_guard
BEFORE INSERT ON ooh_data.site_population_radius_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.guard_population_radius_replay_drift();

CREATE OR REPLACE FUNCTION ooh_data.guard_accessible_population_replay_drift()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing ooh_data.site_accessible_population_context%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM ooh_data.site_accessible_population_context
  WHERE snapshot_id=NEW.snapshot_id
    AND site_id=NEW.site_id
    AND coordinate_assertion_id=NEW.coordinate_assertion_id
    AND access_mode=NEW.access_mode
    AND threshold_minutes=NEW.threshold_minutes;

  IF FOUND AND to_jsonb(existing) IS DISTINCT FROM to_jsonb(NEW) THEN
    RAISE EXCEPTION 'RASTER_CONTEXT_REPLAY_DRIFT:site_accessible_population_context:%:%:%:%:%',
      NEW.snapshot_id, NEW.site_id, NEW.coordinate_assertion_id,
      NEW.access_mode, NEW.threshold_minutes;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS accessible_population_replay_drift_guard
  ON ooh_data.site_accessible_population_context;
CREATE TRIGGER accessible_population_replay_drift_guard
BEFORE INSERT ON ooh_data.site_accessible_population_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.guard_accessible_population_replay_drift();
