-- T5B: production movement promotion must be tied to a deterministic
-- block-level semantic evaluation, not only to a declared summary report.

ALTER TABLE ooh_data.calibration_promotion_runs
  ADD COLUMN IF NOT EXISTS movement_evaluation_version text,
  ADD COLUMN IF NOT EXISTS movement_evaluation_digest text,
  ADD COLUMN IF NOT EXISTS movement_report_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evaluation_failure_codes text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE ooh_data.calibration_promotion_runs
  DROP CONSTRAINT IF EXISTS calibration_promotion_runs_movement_evaluation_version_check;
ALTER TABLE ooh_data.calibration_promotion_runs
  ADD CONSTRAINT calibration_promotion_runs_movement_evaluation_version_check
  CHECK (
    movement_evaluation_version IS NULL
    OR movement_evaluation_version = 'movement-calibration-evaluation-v1'
  );

ALTER TABLE ooh_data.calibration_promotion_runs
  DROP CONSTRAINT IF EXISTS calibration_promotion_runs_movement_evaluation_digest_check;
ALTER TABLE ooh_data.calibration_promotion_runs
  ADD CONSTRAINT calibration_promotion_runs_movement_evaluation_digest_check
  CHECK (
    movement_evaluation_digest IS NULL
    OR movement_evaluation_digest ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE ooh_data.calibration_promotion_runs
  DROP CONSTRAINT IF EXISTS calibration_promotion_runs_verified_movement_gate_check;
ALTER TABLE ooh_data.calibration_promotion_runs
  ADD CONSTRAINT calibration_promotion_runs_verified_movement_gate_check
  CHECK (
    NOT eligible_for_evidence_c
    OR (
      movement_report_verified
      AND movement_evaluation_version = 'movement-calibration-evaluation-v1'
      AND movement_evaluation_digest IS NOT NULL
      AND cardinality(evaluation_failure_codes) = 0
    )
  );

CREATE OR REPLACE FUNCTION ooh_data.validate_calibration_promotion_package_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  package_row ooh_data.calibration_evidence_packages%ROWTYPE;
BEGIN
  IF NEW.package_digest IS NULL THEN
    IF NEW.eligible_for_evidence_c THEN
      RAISE EXCEPTION 'CALIBRATION_PROMOTION_PACKAGE_REQUIRED';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO package_row
  FROM ooh_data.calibration_evidence_packages
  WHERE package_digest = NEW.package_digest;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CALIBRATION_PROMOTION_PACKAGE_NOT_FOUND:%', NEW.package_digest;
  END IF;

  IF NEW.submitted_digest IS DISTINCT FROM package_row.package_digest
     OR NEW.evidence_environment IS DISTINCT FROM package_row.evidence_environment
     OR NEW.movement_calibration_gate_version IS DISTINCT FROM package_row.movement_calibration_gate_version THEN
    RAISE EXCEPTION 'CALIBRATION_PROMOTION_PACKAGE_MISMATCH:%', NEW.package_digest;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS calibration_promotion_package_identity_guard
  ON ooh_data.calibration_promotion_runs;
CREATE TRIGGER calibration_promotion_package_identity_guard
BEFORE INSERT ON ooh_data.calibration_promotion_runs
FOR EACH ROW
EXECUTE FUNCTION ooh_data.validate_calibration_promotion_package_identity();
