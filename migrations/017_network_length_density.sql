ALTER TABLE ooh_data.site_network_context
  ADD COLUMN road_length_m double precision NOT NULL DEFAULT 0
    CHECK (road_length_m >= 0),
  ADD COLUMN major_road_length_m double precision NOT NULL DEFAULT 0
    CHECK (major_road_length_m >= 0),
  ADD COLUMN road_density_km_per_km2 double precision NOT NULL DEFAULT 0
    CHECK (road_density_km_per_km2 >= 0),
  ADD COLUMN major_road_density_km_per_km2 double precision NOT NULL DEFAULT 0
    CHECK (major_road_density_km_per_km2 >= 0),
  ADD COLUMN road_class_length_m jsonb NOT NULL DEFAULT '{}'::jsonb;

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
  n.road_length_m,
  n.major_road_length_m,
  n.road_density_km_per_km2,
  n.major_road_density_km_per_km2,
  n.road_class_length_m,
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
