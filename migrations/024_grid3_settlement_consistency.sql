CREATE OR REPLACE FUNCTION ooh_data.validate_grid3_settlement_snapshot_source()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  product_role text;
  product_version text;
  artifact_field_map_fingerprint text;
  license_id_value text;
  commercial_status text;
  license_review jsonb;
BEGIN
  SELECT
    a.metadata->>'grid3ProductRole',
    a.metadata->>'productVersion',
    a.metadata->>'fieldMapFingerprint',
    a.license_id,
    a.commercial_use_status,
    a.metadata->'licenseReview'
  INTO
    product_role, product_version, artifact_field_map_fingerprint,
    license_id_value, commercial_status, license_review
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=NEW.settlement_source_id
    AND a.artifact_sha256=NEW.settlement_artifact_sha256;

  IF product_role IS DISTINCT FROM 'settlement_extents'
     OR product_version IS DISTINCT FROM 'v4.1' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_ARTIFACT_ROLE_OR_VERSION_MISMATCH:%:%', product_role, product_version;
  END IF;
  IF artifact_field_map_fingerprint IS NULL
     OR artifact_field_map_fingerprint <> NEW.field_map_fingerprint THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_FIELD_MAP_FINGERPRINT_MISMATCH';
  END IF;
  IF commercial_status IS DISTINCT FROM 'permitted'
     OR license_id_value IS NULL
     OR license_id_value = ''
     OR license_id_value LIKE '%REVIEW%'
     OR license_id_value LIKE '%UNKNOWN%'
     OR jsonb_typeof(license_review) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_LICENSE_REVIEW_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.enrichment_runs r
    WHERE r.source_id=NEW.settlement_source_id
      AND r.artifact_sha256=NEW.settlement_artifact_sha256
      AND r.adapter_version='grid3-settlement-adapter-v1'
      AND r.status='succeeded'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_IMPORT_NOT_READY';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE ooh_data.site_settlement_context
  DROP CONSTRAINT IF EXISTS site_settlement_settled_area_within_buffer_check;
ALTER TABLE ooh_data.site_settlement_context
  ADD CONSTRAINT site_settlement_settled_area_within_buffer_check
  CHECK (settled_area_m2 <= buffer_area_m2 * 1.00000001);

ALTER TABLE ooh_data.site_settlement_context
  DROP CONSTRAINT IF EXISTS site_settlement_largest_component_area_check;
ALTER TABLE ooh_data.site_settlement_context
  ADD CONSTRAINT site_settlement_largest_component_area_check
  CHECK (largest_component_area_m2 <= settled_area_m2 * 1.00000001);

ALTER TABLE ooh_data.site_settlement_context
  DROP CONSTRAINT IF EXISTS site_settlement_component_area_alignment_check;
ALTER TABLE ooh_data.site_settlement_context
  ADD CONSTRAINT site_settlement_component_area_alignment_check
  CHECK (
    (
      settled_area_m2 = 0
      AND intersecting_source_extent_count = 0
      AND settled_component_count = 0
      AND largest_component_area_m2 = 0
      AND largest_component_share IS NULL
    )
    OR (
      settled_area_m2 > 0
      AND intersecting_source_extent_count > 0
      AND settled_component_count > 0
      AND largest_component_area_m2 > 0
      AND largest_component_share IS NOT NULL
    )
  );

ALTER TABLE ooh_data.site_settlement_context
  DROP CONSTRAINT IF EXISTS site_settlement_nearest_alignment_check;
ALTER TABLE ooh_data.site_settlement_context
  ADD CONSTRAINT site_settlement_nearest_alignment_check
  CHECK (
    (inside_settlement AND nearest_settlement_m = 0)
    OR (NOT inside_settlement AND nearest_settlement_m IS NOT NULL AND nearest_settlement_m >= 0)
  );
