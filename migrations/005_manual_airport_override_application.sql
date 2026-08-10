CREATE OR REPLACE FUNCTION ooh_data.apply_manual_airport_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.mapping_method <> 'manual_review' THEN
    RETURN NEW;
  END IF;

  UPDATE ooh_data.faan_airport_assertions a
  SET airport_id = NEW.airport_id,
      assertion_method = 'manual_review',
      last_resolution_run_id = NEW.last_resolution_run_id
  FROM ooh_data.faan_monthly_observations m
  WHERE a.resolver_version = NEW.resolver_version
    AND a.record_scope = 'monthly'
    AND a.source_id = m.source_id
    AND a.source_sha256 = m.source_sha256
    AND a.source_record_id = m.source_record_id
    AND (
      trim(COALESCE(m.airport_name, '')) = NEW.source_literal
      OR trim(COALESCE(m.airport_label, '')) = NEW.source_literal
    );

  UPDATE ooh_data.faan_airport_assertions a
  SET airport_id = NEW.airport_id,
      assertion_method = 'manual_review',
      last_resolution_run_id = NEW.last_resolution_run_id
  FROM ooh_data.faan_annual_observations m
  WHERE a.resolver_version = NEW.resolver_version
    AND a.record_scope = 'annual'
    AND a.source_id = m.source_id
    AND a.source_sha256 = m.source_sha256
    AND a.source_record_id = m.source_record_id
    AND (
      trim(COALESCE(m.airport_name, '')) = NEW.source_literal
      OR trim(COALESCE(m.airport_label, '')) = NEW.source_literal
    );

  UPDATE ooh_data.resolution_review_items r
  SET review_status = 'resolved',
      last_resolution_run_id = NEW.last_resolution_run_id,
      updated_at = now(),
      details = r.details || jsonb_build_object(
        'resolvedBy', 'manual_airport_alias',
        'targetAirportId', NEW.airport_id,
        'evidenceSourceId', NEW.evidence_source_id,
        'evidenceRevision', NEW.evidence_revision
      )
  WHERE r.domain = 'airport_identity'
    AND r.resolver_version = NEW.resolver_version
    AND r.review_status = 'open'
    AND r.source_literal = NEW.source_literal;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS airport_manual_alias_apply ON ooh_data.airport_aliases;
CREATE TRIGGER airport_manual_alias_apply
AFTER INSERT ON ooh_data.airport_aliases
FOR EACH ROW
WHEN (NEW.mapping_method = 'manual_review')
EXECUTE FUNCTION ooh_data.apply_manual_airport_alias();
