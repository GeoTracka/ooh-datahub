CREATE OR REPLACE FUNCTION ooh_data.prefer_manual_airport_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  source_literal text;
  manual_airport_id text;
BEGIN
  IF NEW.record_scope = 'monthly' THEN
    SELECT trim(COALESCE(m.airport_name, m.airport_label, ''))
    INTO source_literal
    FROM ooh_data.faan_monthly_observations m
    WHERE m.source_id = NEW.source_id
      AND m.source_sha256 = NEW.source_sha256
      AND m.source_record_id = NEW.source_record_id;
  ELSE
    SELECT trim(COALESCE(m.airport_name, m.airport_label, ''))
    INTO source_literal
    FROM ooh_data.faan_annual_observations m
    WHERE m.source_id = NEW.source_id
      AND m.source_sha256 = NEW.source_sha256
      AND m.source_record_id = NEW.source_record_id;
  END IF;

  IF source_literal IS NULL OR source_literal = '' THEN
    RETURN NEW;
  END IF;

  SELECT a.airport_id
  INTO manual_airport_id
  FROM ooh_data.airport_aliases a
  WHERE a.resolver_version = NEW.resolver_version
    AND a.mapping_method = 'manual_review'
    AND a.source_literal = source_literal
  ORDER BY a.alias_id
  LIMIT 1;

  IF manual_airport_id IS NOT NULL THEN
    NEW.airport_id := manual_airport_id;
    NEW.assertion_method := 'manual_review';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS airport_manual_alias_precedence ON ooh_data.faan_airport_assertions;
CREATE TRIGGER airport_manual_alias_precedence
BEFORE INSERT OR UPDATE OF airport_id, assertion_method
ON ooh_data.faan_airport_assertions
FOR EACH ROW
EXECUTE FUNCTION ooh_data.prefer_manual_airport_alias();
