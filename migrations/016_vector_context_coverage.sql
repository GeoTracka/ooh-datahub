CREATE TABLE IF NOT EXISTS ooh_data.site_vector_context_coverage (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_vector_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  places_covered boolean NOT NULL,
  roads_covered boolean NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('full', 'places_only', 'roads_only', 'uncovered')),
  semantic_label text NOT NULL DEFAULT 'source_reduction_coverage_not_feature_absence'
    CHECK (semantic_label = 'source_reduction_coverage_not_feature_absence'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, radius_m),
  CHECK (
    coverage_status = CASE
      WHEN places_covered AND roads_covered THEN 'full'
      WHEN places_covered THEN 'places_only'
      WHEN roads_covered THEN 'roads_only'
      ELSE 'uncovered'
    END
  )
);

-- Migration 014 created this view before source-reduction coverage existed.
-- The coverage columns intentionally change the public view shape, so recreate
-- it explicitly instead of relying on CREATE OR REPLACE's positional-column
-- compatibility rules.
DROP VIEW IF EXISTS ooh_data.site_vector_context_latest;
CREATE VIEW ooh_data.site_vector_context_latest AS
WITH latest AS (
  SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id, c.radius_m)
    c.snapshot_id,
    c.site_id,
    c.coordinate_assertion_id,
    c.radius_m,
    c.places_covered,
    c.roads_covered,
    c.coverage_status,
    c.decision_use,
    s.created_at
  FROM ooh_data.site_vector_context_coverage c
  JOIN ooh_data.site_vector_context_snapshots s USING (snapshot_id)
  ORDER BY c.site_id, c.coordinate_assertion_id, c.radius_m, s.created_at DESC, c.snapshot_id DESC
)
SELECT
  l.snapshot_id,
  l.site_id,
  l.coordinate_assertion_id,
  l.radius_m,
  l.places_covered,
  l.roads_covered,
  l.coverage_status,
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
  l.decision_use
FROM latest l
LEFT JOIN ooh_data.site_destination_context d
  USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
LEFT JOIN ooh_data.site_network_context n
  USING (snapshot_id, site_id, coordinate_assertion_id, radius_m);
