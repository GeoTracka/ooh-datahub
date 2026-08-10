ALTER TABLE ooh_data.resolution_runs
  ADD COLUMN IF NOT EXISTS run_kind text NOT NULL DEFAULT 'rebuild';

ALTER TABLE ooh_data.resolution_runs
  DROP CONSTRAINT IF EXISTS resolution_runs_run_kind_check;
ALTER TABLE ooh_data.resolution_runs
  ADD CONSTRAINT resolution_runs_run_kind_check
  CHECK (run_kind IN ('rebuild', 'assertion_import'));

ALTER TABLE ooh_data.airport_aliases
  ADD COLUMN IF NOT EXISTS evidence_source_id text;
ALTER TABLE ooh_data.airport_aliases
  ADD COLUMN IF NOT EXISTS evidence_revision text;

ALTER TABLE ooh_data.airport_aliases
  DROP CONSTRAINT IF EXISTS airport_aliases_manual_evidence_check;
ALTER TABLE ooh_data.airport_aliases
  ADD CONSTRAINT airport_aliases_manual_evidence_check
  CHECK (
    mapping_method <> 'manual_review'
    OR (
      evidence_source_id IS NOT NULL AND length(trim(evidence_source_id)) > 0
      AND evidence_revision IS NOT NULL AND length(trim(evidence_revision)) > 0
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS site_coordinate_assertions_evidence_identity_idx
  ON ooh_data.site_coordinate_assertions (
    site_id,
    coordinate_source_id,
    COALESCE(source_artifact_id, ''),
    enrichment_revision
  );

CREATE TABLE IF NOT EXISTS ooh_data.site_identity_decisions (
  decision_id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  decision_status text NOT NULL CHECK (decision_status IN ('confirmed', 'rejected')),
  decision_method text NOT NULL CHECK (decision_method IN ('field_verification', 'authoritative_registry', 'manual_review')),
  evidence_source_id text NOT NULL,
  evidence_revision text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, evidence_source_id, evidence_revision)
);

CREATE OR REPLACE VIEW ooh_data.site_spatial_enrichment_queue AS
SELECT
  s.site_id,
  s.resolver_version,
  s.representative_address,
  st.canonical_name AS state_name,
  ct.canonical_name AS city_name,
  f.canonical_name AS format_name,
  s.identity_status,
  CASE
    WHEN s.identity_status <> 'confirmed' THEN 'site_identity_not_confirmed'
    ELSE 'approved_coordinate_missing'
  END AS reason
FROM ooh_data.site_entities s
JOIN ooh_data.canonical_entities st ON st.entity_id = s.state_entity_id
JOIN ooh_data.canonical_entities ct ON ct.entity_id = s.city_entity_id
JOIN ooh_data.canonical_entities f ON f.entity_id = s.format_entity_id
WHERE s.identity_status <> 'rejected'
  AND (
    s.identity_status <> 'confirmed'
    OR NOT EXISTS (
      SELECT 1
      FROM ooh_data.site_coordinate_assertions c
      WHERE c.site_id = s.site_id
        AND c.assertion_status = 'approved'
    )
  );
