CREATE OR REPLACE FUNCTION ooh_data.populate_site_network_length_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  site_geog geography(Point, 4326);
  roads_source_id text;
  roads_sha text;
  road_buffer geometry;
  total_length double precision;
  major_length double precision;
  class_lengths jsonb;
  area_m2 double precision;
BEGIN
  SELECT
    ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography
  INTO site_geog
  FROM ooh_data.site_coordinate_assertions c
  WHERE c.assertion_id = NEW.coordinate_assertion_id;

  IF site_geog IS NULL THEN
    RAISE EXCEPTION 'NETWORK_CONTEXT_COORDINATE_ASSERTION_MISSING:%', NEW.coordinate_assertion_id;
  END IF;

  SELECT s.roads_source_id, s.roads_artifact_sha256
  INTO roads_source_id, roads_sha
  FROM ooh_data.site_vector_context_snapshots s
  WHERE s.snapshot_id = NEW.snapshot_id;

  IF roads_source_id IS NULL OR roads_sha IS NULL THEN
    RAISE EXCEPTION 'NETWORK_CONTEXT_SNAPSHOT_ROAD_ARTIFACT_MISSING:%', NEW.snapshot_id;
  END IF;

  road_buffer := ST_Buffer(site_geog, NEW.radius_m)::geometry;

  WITH clipped AS (
    SELECT
      r.road_class,
      ST_Length(
        ST_Intersection(r.geog::geometry, road_buffer)::geography
      ) AS clipped_length_m
    FROM ooh_data.overture_road_segments r
    WHERE r.source_id = roads_source_id
      AND r.artifact_sha256 = roads_sha
      AND ST_DWithin(site_geog, r.geog, NEW.radius_m)
  ),
  by_class AS (
    SELECT road_class, sum(clipped_length_m) AS length_m
    FROM clipped
    WHERE clipped_length_m > 0
    GROUP BY road_class
  )
  SELECT
    coalesce(sum(length_m), 0),
    coalesce(sum(length_m) FILTER (
      WHERE road_class IN ('motorway','trunk','primary','secondary')
    ), 0),
    coalesce(jsonb_object_agg(road_class, length_m ORDER BY road_class), '{}'::jsonb)
  INTO total_length, major_length, class_lengths
  FROM by_class;

  area_m2 := pi() * NEW.radius_m::double precision * NEW.radius_m::double precision;
  NEW.road_length_m := total_length;
  NEW.major_road_length_m := major_length;
  NEW.road_density_km_per_km2 := CASE
    WHEN area_m2 > 0 THEN total_length * 1000.0 / area_m2
    ELSE 0
  END;
  NEW.major_road_density_km_per_km2 := CASE
    WHEN area_m2 > 0 THEN major_length * 1000.0 / area_m2
    ELSE 0
  END;
  NEW.road_class_length_m := class_lengths;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS site_network_length_context_population
  ON ooh_data.site_network_context;
CREATE TRIGGER site_network_length_context_population
BEFORE INSERT ON ooh_data.site_network_context
FOR EACH ROW
EXECUTE FUNCTION ooh_data.populate_site_network_length_context();
