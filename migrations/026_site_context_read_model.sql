-- E3: coherent, provenance-preserving site-context consumption.
--
-- Family "latest" views previously selected the latest row independently per
-- radius. A newer snapshot with fewer radii could therefore leak older rows
-- into the same logical result. E3 selects one snapshot head per
-- site + coordinate assertion + family, then expands only that snapshot.

-- Once governed context references a coordinate assertion, the spatial evidence
-- itself is immutable. Governance state may still move (for example approved ->
-- revoked with renderer eligibility removed). Corrected evidence requires a new
-- assertion ID so historical context keeps the exact point/provenance it used.
CREATE OR REPLACE FUNCTION ooh_data.guard_referenced_coordinate_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (
    (to_jsonb(OLD) - ARRAY['assertion_status', 'renderer_eligibility']::text[])
      IS DISTINCT FROM
    (to_jsonb(NEW) - ARRAY['assertion_status', 'renderer_eligibility']::text[])
  ) AND (
    EXISTS (
      SELECT 1 FROM ooh_data.site_vector_context_coverage c
      WHERE c.coordinate_assertion_id = OLD.assertion_id
    )
    OR EXISTS (
      SELECT 1 FROM ooh_data.site_population_radius_context c
      WHERE c.coordinate_assertion_id = OLD.assertion_id
    )
    OR EXISTS (
      SELECT 1 FROM ooh_data.site_accessible_population_context c
      WHERE c.coordinate_assertion_id = OLD.assertion_id
    )
    OR EXISTS (
      SELECT 1 FROM ooh_data.site_settlement_context c
      WHERE c.coordinate_assertion_id = OLD.assertion_id
    )
  ) THEN
    RAISE EXCEPTION 'COORDINATE_ASSERTION_EVIDENCE_IMMUTABLE:%', OLD.assertion_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS referenced_coordinate_evidence_immutable
  ON ooh_data.site_coordinate_assertions;
CREATE TRIGGER referenced_coordinate_evidence_immutable
BEFORE UPDATE ON ooh_data.site_coordinate_assertions
FOR EACH ROW
EXECUTE FUNCTION ooh_data.guard_referenced_coordinate_evidence_mutation();

-- Tighten an invariant already respected by E2B2 derivation: primary settlement
-- attributes describe a containing extent and cannot be populated when a site
-- is outside every settlement extent.
ALTER TABLE ooh_data.site_settlement_context
  DROP CONSTRAINT IF EXISTS site_settlement_primary_containment_alignment_check;
ALTER TABLE ooh_data.site_settlement_context
  ADD CONSTRAINT site_settlement_primary_containment_alignment_check
  CHECK (
    inside_settlement
    OR (
      primary_settlement_feature_id IS NULL
      AND core_depth_m IS NULL
      AND primary_settlement_area_m2 IS NULL
      AND primary_settlement_perimeter_m IS NULL
      AND primary_settlement_compactness IS NULL
      AND primary_building_count IS NULL
      AND primary_building_density IS NULL
      AND primary_degree_urbanisation IS NULL
      AND primary_population_estimate IS NULL
      AND primary_false_positive_probability IS NULL
      AND primary_place_code IS NULL
    )
  );

CREATE OR REPLACE VIEW ooh_data.site_vector_context_latest AS
WITH head AS (
  SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id)
    c.site_id,
    c.coordinate_assertion_id,
    c.snapshot_id
  FROM ooh_data.site_vector_context_coverage c
  JOIN ooh_data.site_vector_context_snapshots s USING (snapshot_id)
  JOIN ooh_data.site_coordinate_assertions a ON a.assertion_id=c.coordinate_assertion_id
  JOIN ooh_data.site_entities e ON e.site_id=c.site_id
  WHERE e.identity_status='confirmed'
    AND a.assertion_status='approved'
    AND a.renderer_eligibility='maplibre'
    AND a.planning_use='context_only'
  ORDER BY c.site_id, c.coordinate_assertion_id, s.created_at DESC, c.snapshot_id DESC
)
SELECT
  c.snapshot_id,
  c.site_id,
  c.coordinate_assertion_id,
  c.radius_m,
  c.places_covered,
  c.roads_covered,
  c.coverage_status,
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
  c.decision_use
FROM head h
JOIN ooh_data.site_vector_context_coverage c
  USING (site_id, coordinate_assertion_id, snapshot_id)
LEFT JOIN ooh_data.site_destination_context d
  USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
LEFT JOIN ooh_data.site_network_context n
  USING (snapshot_id, site_id, coordinate_assertion_id, radius_m);

CREATE OR REPLACE VIEW ooh_data.site_raster_context_latest AS
WITH head AS (
  SELECT DISTINCT ON (p.site_id, p.coordinate_assertion_id)
    p.site_id,
    p.coordinate_assertion_id,
    p.snapshot_id
  FROM ooh_data.site_population_radius_context p
  JOIN ooh_data.site_raster_context_snapshots s USING (snapshot_id)
  JOIN ooh_data.site_coordinate_assertions a ON a.assertion_id=p.coordinate_assertion_id
  JOIN ooh_data.site_entities e ON e.site_id=p.site_id
  WHERE e.identity_status='confirmed'
    AND a.assertion_status='approved'
    AND a.renderer_eligibility='maplibre'
    AND a.planning_use='context_only'
  ORDER BY p.site_id, p.coordinate_assertion_id, s.created_at DESC, p.snapshot_id DESC
)
SELECT
  p.snapshot_id,
  p.site_id,
  p.coordinate_assertion_id,
  p.radius_m,
  p.population_estimate,
  p.valid_population_cell_count,
  p.nodata_population_cell_count,
  p.extent_fully_covered,
  p.coverage_status,
  s.created_at
FROM head h
JOIN ooh_data.site_population_radius_context p
  USING (site_id, coordinate_assertion_id, snapshot_id)
JOIN ooh_data.site_raster_context_snapshots s USING (snapshot_id);

CREATE OR REPLACE VIEW ooh_data.site_settlement_context_latest AS
WITH head AS (
  SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id)
    c.site_id,
    c.coordinate_assertion_id,
    c.snapshot_id
  FROM ooh_data.site_settlement_context c
  JOIN ooh_data.site_settlement_context_snapshots s USING (snapshot_id)
  JOIN ooh_data.site_coordinate_assertions a ON a.assertion_id=c.coordinate_assertion_id
  JOIN ooh_data.site_entities e ON e.site_id=c.site_id
  WHERE e.identity_status='confirmed'
    AND a.assertion_status='approved'
    AND a.renderer_eligibility='maplibre'
    AND a.planning_use='context_only'
  ORDER BY c.site_id, c.coordinate_assertion_id, s.created_at DESC, c.snapshot_id DESC
)
SELECT
  c.*,
  s.created_at AS snapshot_created_at
FROM head h
JOIN ooh_data.site_settlement_context c
  USING (site_id, coordinate_assertion_id, snapshot_id)
JOIN ooh_data.site_settlement_context_snapshots s USING (snapshot_id);

-- Unified read surface. Family heads are independent and keep exact lineage;
-- they are never collapsed into a fake cross-source snapshot or universal score.
-- Revoked historical coordinate assertions remain auditable but are explicitly
-- marked ineligible for current context interpretation.
CREATE OR REPLACE VIEW ooh_data.site_context_latest AS
WITH
vector_head AS (
  SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id)
    c.site_id,
    c.coordinate_assertion_id,
    c.snapshot_id
  FROM ooh_data.site_vector_context_coverage c
  JOIN ooh_data.site_vector_context_snapshots s USING (snapshot_id)
  ORDER BY c.site_id, c.coordinate_assertion_id, s.created_at DESC, c.snapshot_id DESC
),
raster_head AS (
  SELECT DISTINCT ON (p.site_id, p.coordinate_assertion_id)
    p.site_id,
    p.coordinate_assertion_id,
    p.snapshot_id
  FROM ooh_data.site_population_radius_context p
  JOIN ooh_data.site_raster_context_snapshots s USING (snapshot_id)
  ORDER BY p.site_id, p.coordinate_assertion_id, s.created_at DESC, p.snapshot_id DESC
),
settlement_head AS (
  SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id)
    c.site_id,
    c.coordinate_assertion_id,
    c.snapshot_id
  FROM ooh_data.site_settlement_context c
  JOIN ooh_data.site_settlement_context_snapshots s USING (snapshot_id)
  ORDER BY c.site_id, c.coordinate_assertion_id, s.created_at DESC, c.snapshot_id DESC
),
coordinate_keys AS (
  SELECT
    a.site_id,
    a.assertion_id AS coordinate_assertion_id
  FROM ooh_data.site_coordinate_assertions a
  JOIN ooh_data.site_entities e ON e.site_id=a.site_id
  LEFT JOIN vector_head vh
    ON vh.site_id=a.site_id AND vh.coordinate_assertion_id=a.assertion_id
  LEFT JOIN raster_head rh
    ON rh.site_id=a.site_id AND rh.coordinate_assertion_id=a.assertion_id
  LEFT JOIN settlement_head sh
    ON sh.site_id=a.site_id AND sh.coordinate_assertion_id=a.assertion_id
  WHERE e.identity_status='confirmed'
    AND a.planning_use='context_only'
    AND (
      a.assertion_status='approved'
      OR vh.snapshot_id IS NOT NULL
      OR rh.snapshot_id IS NOT NULL
      OR sh.snapshot_id IS NOT NULL
    )
),
vector_rollup AS (
  SELECT
    h.site_id,
    h.coordinate_assertion_id,
    h.snapshot_id,
    jsonb_agg(
      jsonb_build_object(
        'radiusM', c.radius_m,
        'placesCovered', c.places_covered,
        'roadsCovered', c.roads_covered,
        'coverageStatus', c.coverage_status,
        'placeCount', d.place_count,
        'operatingOrUnknownCount', d.operating_or_unknown_count,
        'highConfidenceCount', d.high_confidence_count,
        'taxonomyL0Counts', d.taxonomy_l0_counts,
        'basicCategoryCounts', d.basic_category_counts,
        'taxonomyEntropy', d.taxonomy_entropy,
        'roadSegmentCount', n.road_segment_count,
        'majorRoadSegmentCount', n.major_road_segment_count,
        'distinctConnectorCount', n.distinct_connector_count,
        'roadClassCounts', n.road_class_counts,
        'roadLengthM', n.road_length_m,
        'majorRoadLengthM', n.major_road_length_m,
        'roadDensityKmPerKm2', n.road_density_km_per_km2,
        'majorRoadDensityKmPerKm2', n.major_road_density_km_per_km2,
        'roadClassLengthM', n.road_class_length_m,
        'nearestRoadM', n.nearest_road_m,
        'nearestRoadClass', n.nearest_road_class,
        'nearestMajorRoadM', n.nearest_major_road_m,
        'nearestMajorRoadClass', n.nearest_major_road_class,
        'destinationSemanticLabel', d.semantic_label,
        'networkSemanticLabel', n.semantic_label
      ) ORDER BY c.radius_m
    ) AS context_rows
  FROM vector_head h
  JOIN ooh_data.site_vector_context_coverage c
    USING (site_id, coordinate_assertion_id, snapshot_id)
  LEFT JOIN ooh_data.site_destination_context d
    USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
  LEFT JOIN ooh_data.site_network_context n
    USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
  GROUP BY h.site_id, h.coordinate_assertion_id, h.snapshot_id
),
population_rollup AS (
  SELECT
    h.site_id,
    h.coordinate_assertion_id,
    h.snapshot_id,
    jsonb_agg(
      jsonb_build_object(
        'radiusM', p.radius_m,
        'populationEstimate', p.population_estimate,
        'candidateCellCount', p.candidate_cell_count,
        'validPopulationCellCount', p.valid_population_cell_count,
        'nodataPopulationCellCount', p.nodata_population_cell_count,
        'extentFullyCovered', p.extent_fully_covered,
        'coverageStatus', p.coverage_status,
        'semanticLabel', p.semantic_label
      ) ORDER BY p.radius_m
    ) AS context_rows
  FROM raster_head h
  JOIN ooh_data.site_population_radius_context p
    USING (site_id, coordinate_assertion_id, snapshot_id)
  GROUP BY h.site_id, h.coordinate_assertion_id, h.snapshot_id
),
accessibility_rollup AS (
  SELECT
    h.site_id,
    h.coordinate_assertion_id,
    h.snapshot_id,
    jsonb_agg(
      jsonb_build_object(
        'accessMode', a.access_mode,
        'thresholdMinutes', a.threshold_minutes,
        'populationEstimate', a.population_estimate,
        'reachablePopulationCellCount', a.reachable_population_cell_count,
        'candidatePopulationCellCount', a.candidate_population_cell_count,
        'validPopulationCellCount', a.valid_population_cell_count,
        'nodataPopulationCellCount', a.nodata_population_cell_count,
        'frictionUnavailablePopulationCellCount', a.friction_unavailable_population_cell_count,
        'reachedFrictionCellCount', a.reached_friction_cell_count,
        'maxReachedMinutes', a.max_reached_minutes,
        'populationExtentFullyCovered', a.population_extent_fully_covered,
        'frictionExtentFullyCovered', a.friction_extent_fully_covered,
        'sourceBoundaryReached', a.source_boundary_reached,
        'coverageStatus', a.coverage_status,
        'semanticLabel', a.semantic_label
      ) ORDER BY a.access_mode, a.threshold_minutes
    ) AS context_rows
  FROM raster_head h
  JOIN ooh_data.site_accessible_population_context a
    USING (site_id, coordinate_assertion_id, snapshot_id)
  GROUP BY h.site_id, h.coordinate_assertion_id, h.snapshot_id
),
settlement_rollup AS (
  SELECT
    h.site_id,
    h.coordinate_assertion_id,
    h.snapshot_id,
    jsonb_agg(
      jsonb_build_object(
        'radiusM', c.radius_m,
        'sourceCovered', c.source_covered,
        'coverageStatus', c.coverage_status,
        'insideSettlement', c.inside_settlement,
        'containingSettlementCount', c.containing_settlement_count,
        'primarySettlementFeatureId', c.primary_settlement_feature_id,
        'nearestSettlementM', c.nearest_settlement_m,
        'coreDepthM', c.core_depth_m,
        'primarySettlementAreaM2', c.primary_settlement_area_m2,
        'primarySettlementCompactness', c.primary_settlement_compactness,
        'primaryBuildingCount', c.primary_building_count,
        'primaryBuildingDensity', c.primary_building_density,
        'primaryDegreeUrbanisation', c.primary_degree_urbanisation,
        'primaryPopulationEstimate', c.primary_population_estimate,
        'primaryFalsePositiveProbability', c.primary_false_positive_probability,
        'settledAreaShare', c.settled_area_share,
        'intersectingSourceExtentCount', c.intersecting_source_extent_count,
        'settledComponentCount', c.settled_component_count,
        'componentDensityPerSqkm', c.component_density_per_sqkm,
        'largestComponentShare', c.largest_component_share,
        'semanticLabel', c.semantic_label
      ) ORDER BY c.radius_m
    ) AS context_rows
  FROM settlement_head h
  JOIN ooh_data.site_settlement_context c
    USING (site_id, coordinate_assertion_id, snapshot_id)
  GROUP BY h.site_id, h.coordinate_assertion_id, h.snapshot_id
)
SELECT
  'site-context-read-model-v1'::text AS read_model_version,
  k.site_id,
  k.coordinate_assertion_id,
  a.assertion_status AS coordinate_assertion_status,
  (
    a.assertion_status='approved'
    AND a.renderer_eligibility='maplibre'
    AND a.planning_use='context_only'
  ) AS coordinate_currently_eligible,
  jsonb_build_object(
    'latitude', a.latitude,
    'longitude', a.longitude,
    'accuracyM', a.coordinate_accuracy_m,
    'sourceKind', a.source_kind,
    'coordinateSourceId', a.coordinate_source_id,
    'sourceArtifactId', a.source_artifact_id,
    'spatialRights', a.spatial_rights,
    'spatialLicenseId', a.spatial_license_id,
    'rendererEligibility', a.renderer_eligibility,
    'enrichmentRevision', a.enrichment_revision,
    'assertedAt', a.asserted_at
  ) AS coordinate_evidence,

  vh.snapshot_id AS vector_snapshot_id,
  CASE WHEN vs.snapshot_id IS NULL THEN NULL ELSE jsonb_build_object(
    'snapshotId', vs.snapshot_id,
    'algorithmVersion', vs.algorithm_version,
    'inputFingerprint', vs.input_fingerprint,
    'sourceArtifacts', jsonb_build_array(
      jsonb_build_object('sourceId', vs.places_source_id, 'artifactSha256', vs.places_artifact_sha256),
      jsonb_build_object('sourceId', vs.roads_source_id, 'artifactSha256', vs.roads_artifact_sha256)
    ),
    'radiiM', to_jsonb(vs.radii_m),
    'snapshotCreatedAt', vs.created_at
  ) END AS vector_provenance,
  COALESCE(vr.context_rows, '[]'::jsonb) AS vector_context,
  CASE
    WHEN NOT (a.assertion_status='approved' AND a.renderer_eligibility='maplibre')
      THEN 'coordinate_not_currently_eligible'
    WHEN vh.snapshot_id IS NULL THEN 'not_derived'
    ELSE NULL
  END AS vector_missing_reason,

  rh.snapshot_id AS raster_snapshot_id,
  CASE WHEN rs.snapshot_id IS NULL THEN NULL ELSE jsonb_build_object(
    'snapshotId', rs.snapshot_id,
    'algorithmVersion', rs.algorithm_version,
    'inputFingerprint', rs.input_fingerprint,
    'sourceArtifacts', jsonb_build_array(
      jsonb_build_object('sourceId', rs.population_source_id, 'artifactSha256', rs.population_artifact_sha256),
      jsonb_build_object('sourceId', rs.walking_source_id, 'artifactSha256', rs.walking_artifact_sha256),
      jsonb_build_object('sourceId', rs.mixed_source_id, 'artifactSha256', rs.mixed_artifact_sha256)
    ),
    'radiiM', to_jsonb(rs.radii_m),
    'thresholdsMinutes', to_jsonb(rs.thresholds_minutes),
    'maxSearchRadiusM', rs.max_search_radius_m,
    'snapshotCreatedAt', rs.created_at
  ) END AS raster_provenance,
  COALESCE(pr.context_rows, '[]'::jsonb) AS population_radius_context,
  COALESCE(ar.context_rows, '[]'::jsonb) AS accessibility_context,
  CASE
    WHEN NOT (a.assertion_status='approved' AND a.renderer_eligibility='maplibre')
      THEN 'coordinate_not_currently_eligible'
    WHEN rh.snapshot_id IS NULL THEN 'not_derived'
    ELSE NULL
  END AS raster_missing_reason,

  sh.snapshot_id AS settlement_snapshot_id,
  CASE WHEN ss.snapshot_id IS NULL THEN NULL ELSE jsonb_build_object(
    'snapshotId', ss.snapshot_id,
    'algorithmVersion', ss.algorithm_version,
    'inputFingerprint', ss.input_fingerprint,
    'sourceArtifacts', jsonb_build_array(
      jsonb_build_object('sourceId', ss.settlement_source_id, 'artifactSha256', ss.settlement_artifact_sha256)
    ),
    'fieldMapFingerprint', ss.field_map_fingerprint,
    'radiiM', to_jsonb(ss.radii_m),
    'snapshotCreatedAt', ss.created_at
  ) END AS settlement_provenance,
  COALESCE(sr.context_rows, '[]'::jsonb) AS settlement_context,
  CASE
    WHEN NOT (a.assertion_status='approved' AND a.renderer_eligibility='maplibre')
      THEN 'coordinate_not_currently_eligible'
    WHEN sh.snapshot_id IS NULL THEN 'not_derived'
    ELSE NULL
  END AS settlement_missing_reason,

  'context_only'::text AS decision_use
FROM coordinate_keys k
JOIN ooh_data.site_coordinate_assertions a
  ON a.site_id=k.site_id AND a.assertion_id=k.coordinate_assertion_id
LEFT JOIN vector_head vh USING (site_id, coordinate_assertion_id)
LEFT JOIN ooh_data.site_vector_context_snapshots vs ON vs.snapshot_id=vh.snapshot_id
LEFT JOIN vector_rollup vr
  ON vr.site_id=k.site_id AND vr.coordinate_assertion_id=k.coordinate_assertion_id AND vr.snapshot_id=vh.snapshot_id
LEFT JOIN raster_head rh USING (site_id, coordinate_assertion_id)
LEFT JOIN ooh_data.site_raster_context_snapshots rs ON rs.snapshot_id=rh.snapshot_id
LEFT JOIN population_rollup pr
  ON pr.site_id=k.site_id AND pr.coordinate_assertion_id=k.coordinate_assertion_id AND pr.snapshot_id=rh.snapshot_id
LEFT JOIN accessibility_rollup ar
  ON ar.site_id=k.site_id AND ar.coordinate_assertion_id=k.coordinate_assertion_id AND ar.snapshot_id=rh.snapshot_id
LEFT JOIN settlement_head sh USING (site_id, coordinate_assertion_id)
LEFT JOIN ooh_data.site_settlement_context_snapshots ss ON ss.snapshot_id=sh.snapshot_id
LEFT JOIN settlement_rollup sr
  ON sr.site_id=k.site_id AND sr.coordinate_assertion_id=k.coordinate_assertion_id AND sr.snapshot_id=sh.snapshot_id;
