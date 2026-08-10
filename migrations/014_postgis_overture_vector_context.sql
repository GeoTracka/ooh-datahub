CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS ooh_data.overture_place_features (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  feature_id text NOT NULL,
  feature_version integer NOT NULL,
  name text,
  basic_category text,
  taxonomy jsonb,
  confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  operating_status text CHECK (operating_status IS NULL OR operating_status IN ('open', 'temporarily_closed', 'permanently_closed')),
  sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) > 0),
  geog geography(Point, 4326) NOT NULL,
  raw_record jsonb NOT NULL,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, feature_id),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS overture_place_features_geog_idx
  ON ooh_data.overture_place_features USING gist (geog);
CREATE INDEX IF NOT EXISTS overture_place_features_category_idx
  ON ooh_data.overture_place_features (basic_category)
  WHERE basic_category IS NOT NULL;

CREATE TABLE IF NOT EXISTS ooh_data.overture_road_segments (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  feature_id text NOT NULL,
  feature_version integer NOT NULL,
  name text,
  road_class text NOT NULL CHECK (road_class IN (
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
    'living_street', 'unclassified', 'service', 'pedestrian', 'footway',
    'steps', 'path', 'track', 'cycleway', 'bridleway', 'unknown'
  )),
  subclass text,
  connectors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(connectors) = 'array'),
  sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) > 0),
  geog geography(LineString, 4326) NOT NULL,
  raw_record jsonb NOT NULL,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, feature_id),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS overture_road_segments_geog_idx
  ON ooh_data.overture_road_segments USING gist (geog);
CREATE INDEX IF NOT EXISTS overture_road_segments_class_idx
  ON ooh_data.overture_road_segments (road_class);

CREATE TABLE IF NOT EXISTS ooh_data.site_vector_context_runs (
  run_id uuid PRIMARY KEY,
  algorithm_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_manifest jsonb NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  snapshot_id text,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS site_vector_context_runs_fingerprint_idx
  ON ooh_data.site_vector_context_runs (algorithm_version, input_fingerprint, status);

CREATE TABLE IF NOT EXISTS ooh_data.site_vector_context_snapshots (
  snapshot_id text PRIMARY KEY,
  algorithm_version text NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  places_source_id text NOT NULL,
  places_artifact_sha256 text NOT NULL,
  roads_source_id text NOT NULL,
  roads_artifact_sha256 text NOT NULL,
  radii_m integer[] NOT NULL CHECK (cardinality(radii_m) > 0),
  first_context_run_id uuid NOT NULL REFERENCES ooh_data.site_vector_context_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (algorithm_version, input_fingerprint),
  FOREIGN KEY (places_source_id, places_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT,
  FOREIGN KEY (roads_source_id, roads_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

ALTER TABLE ooh_data.site_vector_context_runs
  DROP CONSTRAINT IF EXISTS site_vector_context_runs_snapshot_fk;
ALTER TABLE ooh_data.site_vector_context_runs
  ADD CONSTRAINT site_vector_context_runs_snapshot_fk
  FOREIGN KEY (snapshot_id) REFERENCES ooh_data.site_vector_context_snapshots (snapshot_id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ooh_data.site_destination_context (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_vector_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  place_count integer NOT NULL CHECK (place_count >= 0),
  operating_or_unknown_count integer NOT NULL CHECK (operating_or_unknown_count >= 0),
  high_confidence_count integer NOT NULL CHECK (high_confidence_count >= 0),
  temporarily_closed_count integer NOT NULL CHECK (temporarily_closed_count >= 0),
  permanently_closed_count integer NOT NULL CHECK (permanently_closed_count >= 0),
  taxonomy_l0_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  basic_category_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  taxonomy_entropy double precision CHECK (taxonomy_entropy IS NULL OR taxonomy_entropy >= 0),
  semantic_label text NOT NULL DEFAULT 'destination_presence_context_not_visitation' CHECK (semantic_label = 'destination_presence_context_not_visitation'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, radius_m)
);

CREATE TABLE IF NOT EXISTS ooh_data.site_network_context (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_vector_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  road_segment_count integer NOT NULL CHECK (road_segment_count >= 0),
  major_road_segment_count integer NOT NULL CHECK (major_road_segment_count >= 0),
  distinct_connector_count integer NOT NULL CHECK (distinct_connector_count >= 0),
  road_class_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  nearest_road_m double precision CHECK (nearest_road_m IS NULL OR nearest_road_m >= 0),
  nearest_road_class text,
  nearest_major_road_m double precision CHECK (nearest_major_road_m IS NULL OR nearest_major_road_m >= 0),
  nearest_major_road_class text,
  semantic_label text NOT NULL DEFAULT 'network_prominence_context_not_observed_traffic' CHECK (semantic_label = 'network_prominence_context_not_observed_traffic'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, radius_m)
);

CREATE OR REPLACE VIEW ooh_data.site_vector_context_latest AS
SELECT DISTINCT ON (d.site_id, d.coordinate_assertion_id, d.radius_m)
  d.snapshot_id,
  d.site_id,
  d.coordinate_assertion_id,
  d.radius_m,
  d.place_count,
  d.operating_or_unknown_count,
  d.high_confidence_count,
  d.temporarily_closed_count,
  d.permanently_closed_count,
  d.taxonomy_l0_counts,
  d.basic_category_counts,
  d.taxonomy_entropy,
  n.road_segment_count,
  n.major_road_segment_count,
  n.distinct_connector_count,
  n.road_class_counts,
  n.nearest_road_m,
  n.nearest_road_class,
  n.nearest_major_road_m,
  n.nearest_major_road_class,
  d.decision_use
FROM ooh_data.site_destination_context d
JOIN ooh_data.site_network_context n
  USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
JOIN ooh_data.site_vector_context_snapshots s USING (snapshot_id)
ORDER BY d.site_id, d.coordinate_assertion_id, d.radius_m, s.created_at DESC, d.snapshot_id DESC;
