CREATE TABLE IF NOT EXISTS ooh_data.enrichment_artifact_derivations (
  child_source_id text NOT NULL,
  child_artifact_sha256 text NOT NULL,
  parent_source_id text NOT NULL,
  parent_artifact_sha256 text NOT NULL,
  transform_id text NOT NULL CHECK (length(trim(transform_id)) > 0),
  transform_version text NOT NULL CHECK (length(trim(transform_version)) > 0),
  transform_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_source_id, child_artifact_sha256, parent_source_id, parent_artifact_sha256),
  FOREIGN KEY (child_source_id, child_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT,
  FOREIGN KEY (parent_source_id, parent_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT,
  CHECK (
    child_source_id <> parent_source_id
    OR child_artifact_sha256 <> parent_artifact_sha256
  )
);

CREATE OR REPLACE FUNCTION ooh_data.reject_enrichment_artifact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'ENRICHMENT_ARTIFACT_IMMUTABLE:%:%', OLD.source_id, OLD.artifact_sha256;
END;
$function$;

DROP TRIGGER IF EXISTS enrichment_artifact_immutable ON ooh_data.enrichment_artifacts;
CREATE TRIGGER enrichment_artifact_immutable
BEFORE UPDATE OR DELETE ON ooh_data.enrichment_artifacts
FOR EACH ROW
EXECUTE FUNCTION ooh_data.reject_enrichment_artifact_mutation();

CREATE OR REPLACE VIEW ooh_data.open_enrichment_artifact_lineage AS
SELECT
  child.source_id AS child_source_id,
  child.artifact_sha256 AS child_artifact_sha256,
  child.source_release AS child_source_release,
  parent.source_id AS parent_source_id,
  parent.artifact_sha256 AS parent_artifact_sha256,
  parent.source_release AS parent_source_release,
  d.transform_id,
  d.transform_version,
  d.transform_parameters
FROM ooh_data.enrichment_artifact_derivations d
JOIN ooh_data.enrichment_artifacts child
  ON child.source_id=d.child_source_id AND child.artifact_sha256=d.child_artifact_sha256
JOIN ooh_data.enrichment_artifacts parent
  ON parent.source_id=d.parent_source_id AND parent.artifact_sha256=d.parent_artifact_sha256;
