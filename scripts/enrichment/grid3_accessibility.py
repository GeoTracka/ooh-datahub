#!/usr/bin/env python3
from __future__ import annotations

import argparse
import heapq
import json
import math
import sys
from dataclasses import dataclass
from typing import Any

import numpy as np
from osgeo import gdal, osr

WORKER_VERSION = "grid3-accessibility-worker-v1"
EARTH_RADIUS_M = 6_371_008.8


def fail(code: str, detail: str | None = None) -> None:
    raise RuntimeError(code if not detail else f"{code}:{detail}")


def finite(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def dataset(path: str) -> gdal.Dataset:
    ds = gdal.Open(path, gdal.GA_ReadOnly)
    if ds is None:
        fail("GRID3_RASTER_OPEN_FAILED", path)
    return ds


def spatial_ref(ds: gdal.Dataset) -> osr.SpatialReference:
    projection = ds.GetProjectionRef() or ds.GetProjection()
    if not projection:
        fail("GRID3_RASTER_PROJECTION_REQUIRED")
    srs = osr.SpatialReference()
    if srs.ImportFromWkt(projection) != 0:
        fail("GRID3_RASTER_PROJECTION_INVALID")
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def epsg_code(srs: osr.SpatialReference) -> int:
    clone = srs.Clone()
    clone.AutoIdentifyEPSG()
    for key in (None, "PROJCS", "GEOGCS"):
        authority = clone.GetAuthorityCode(key)
        if authority:
            try:
                return int(authority)
            except ValueError:
                pass
    fail("GRID3_RASTER_EPSG_REQUIRED")


def geotransform(ds: gdal.Dataset) -> tuple[float, float, float, float, float, float]:
    gt = ds.GetGeoTransform(can_return_null=True)
    if gt is None:
        fail("GRID3_RASTER_GEOTRANSFORM_REQUIRED")
    return tuple(float(v) for v in gt)  # type: ignore[return-value]


def corner_xy(gt: tuple[float, float, float, float, float, float], col: float, row: float) -> tuple[float, float]:
    return (
        gt[0] + col * gt[1] + row * gt[2],
        gt[3] + col * gt[4] + row * gt[5],
    )


def transformer(source: osr.SpatialReference, target: osr.SpatialReference) -> osr.CoordinateTransformation:
    source_clone = source.Clone()
    target_clone = target.Clone()
    source_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(source_clone, target_clone)


def wgs84_srs() -> osr.SpatialReference:
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def transform_point(tx: osr.CoordinateTransformation, x: float, y: float) -> tuple[float, float]:
    result = tx.TransformPoint(float(x), float(y))
    return float(result[0]), float(result[1])


def inspect_raster(path: str) -> dict[str, Any]:
    ds = dataset(path)
    gt = geotransform(ds)
    srs = spatial_ref(ds)
    epsg = epsg_code(srs)
    rotated = abs(gt[2]) > 1e-12 or abs(gt[4]) > 1e-12
    band = ds.GetRasterBand(1) if ds.RasterCount else None
    if band is None:
        fail("GRID3_RASTER_BAND_REQUIRED")
    no_data = band.GetNoDataValue()
    corners = [
        corner_xy(gt, 0, 0),
        corner_xy(gt, ds.RasterXSize, 0),
        corner_xy(gt, 0, ds.RasterYSize),
        corner_xy(gt, ds.RasterXSize, ds.RasterYSize),
    ]
    xs = [p[0] for p in corners]
    ys = [p[1] for p in corners]
    native_bounds = [min(xs), min(ys), max(xs), max(ys)]
    to_wgs = transformer(srs, wgs84_srs())
    wgs_corners = [transform_point(to_wgs, x, y) for x, y in corners]
    lons = [p[0] for p in wgs_corners]
    lats = [p[1] for p in wgs_corners]
    return {
        "workerVersion": WORKER_VERSION,
        "driver": ds.GetDriver().ShortName,
        "width": int(ds.RasterXSize),
        "height": int(ds.RasterYSize),
        "bandCount": int(ds.RasterCount),
        "dataType": gdal.GetDataTypeName(band.DataType),
        "epsg": epsg,
        "geotransform": [float(v) for v in gt],
        "pixelSize": [abs(float(gt[1])), abs(float(gt[5]))],
        "rotated": rotated,
        "noData": None if no_data is None else float(no_data),
        "unitType": band.GetUnitType() or None,
        "boundsNative": [float(v) for v in native_bounds],
        "boundsWgs84": [float(min(lons)), float(min(lats)), float(max(lons)), float(max(lats))],
        "pointInPixel": "center",
    }


def haversine_m(lon1: np.ndarray, lat1: np.ndarray, lon2: float, lat2: float) -> np.ndarray:
    lon1r = np.radians(lon1)
    lat1r = np.radians(lat1)
    lon2r = math.radians(lon2)
    lat2r = math.radians(lat2)
    dlon = lon1r - lon2r
    dlat = lat1r - lat2r
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1r) * math.cos(lat2r) * np.sin(dlon / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_M * np.arcsin(np.minimum(1.0, np.sqrt(a)))


def destination_point(lon: float, lat: float, bearing_degrees: float, distance_m: float) -> tuple[float, float]:
    angular = distance_m / EARTH_RADIUS_M
    bearing = math.radians(bearing_degrees)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(angular) + math.cos(lat1) * math.sin(angular) * math.cos(bearing))
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lon2), math.degrees(lat2)


def invert_geotransform(gt: tuple[float, float, float, float, float, float]) -> tuple[float, float, float, float, float, float]:
    inv = gdal.InvGeoTransform(gt)
    if inv is None:
        fail("GRID3_RASTER_GEOTRANSFORM_NOT_INVERTIBLE")
    return tuple(float(v) for v in inv)  # type: ignore[return-value]


def world_to_pixel(inv_gt: tuple[float, float, float, float, float, float], x: float, y: float) -> tuple[float, float]:
    return (
        inv_gt[0] + inv_gt[1] * x + inv_gt[2] * y,
        inv_gt[3] + inv_gt[4] * x + inv_gt[5] * y,
    )


@dataclass(frozen=True)
class RasterWindow:
    xoff: int
    yoff: int
    width: int
    height: int
    fully_covered: bool


def bounded_window_around_radius(ds: gdal.Dataset, lon: float, lat: float, radius_m: float) -> RasterWindow:
    srs = spatial_ref(ds)
    to_native = transformer(wgs84_srs(), srs)
    ring = [destination_point(lon, lat, bearing, radius_m) for bearing in range(0, 360, 45)]
    native = [transform_point(to_native, p[0], p[1]) for p in ring]
    native.append(transform_point(to_native, lon, lat))
    inv_gt = invert_geotransform(geotransform(ds))
    pixels = [world_to_pixel(inv_gt, x, y) for x, y in native]
    cols = [p[0] for p in pixels]
    rows = [p[1] for p in pixels]
    raw_x0 = math.floor(min(cols)) - 2
    raw_x1 = math.ceil(max(cols)) + 2
    raw_y0 = math.floor(min(rows)) - 2
    raw_y1 = math.ceil(max(rows)) + 2
    fully = raw_x0 >= 0 and raw_y0 >= 0 and raw_x1 <= ds.RasterXSize and raw_y1 <= ds.RasterYSize
    x0 = max(0, raw_x0)
    y0 = max(0, raw_y0)
    x1 = min(ds.RasterXSize, raw_x1)
    y1 = min(ds.RasterYSize, raw_y1)
    if x1 <= x0 or y1 <= y0:
        fail("GRID3_SITE_OUTSIDE_RASTER_COVERAGE")
    return RasterWindow(x0, y0, x1 - x0, y1 - y0, fully)


def sub_geotransform(gt: tuple[float, float, float, float, float, float], window: RasterWindow) -> tuple[float, float, float, float, float, float]:
    origin_x, origin_y = corner_xy(gt, window.xoff, window.yoff)
    return (origin_x, gt[1], gt[2], origin_y, gt[4], gt[5])


def valid_mask(values: np.ndarray, no_data: float | None, *, positive: bool) -> np.ndarray:
    mask = np.isfinite(values)
    if no_data is not None:
        mask &= values != float(no_data)
    if positive:
        mask &= values > 0
    else:
        mask &= values >= 0
    return mask


def population_radius_context(pop_ds: gdal.Dataset, lon: float, lat: float, radii_m: list[int]) -> list[dict[str, Any]]:
    max_radius = max(radii_m)
    window = bounded_window_around_radius(pop_ds, lon, lat, max_radius)
    band = pop_ds.GetRasterBand(1)
    no_data = band.GetNoDataValue()
    values = band.ReadAsArray(window.xoff, window.yoff, window.width, window.height).astype(np.float64)
    valid = valid_mask(values, no_data, positive=False)
    gt = sub_geotransform(geotransform(pop_ds), window)
    rows, cols = np.indices(values.shape, dtype=np.float64)
    center_lon = gt[0] + (cols + 0.5) * gt[1] + (rows + 0.5) * gt[2]
    center_lat = gt[3] + (cols + 0.5) * gt[4] + (rows + 0.5) * gt[5]
    distances = haversine_m(center_lon, center_lat, lon, lat)
    results: list[dict[str, Any]] = []
    for radius in radii_m:
        candidate = distances <= float(radius)
        valid_cells = candidate & valid
        nodata_cells = candidate & ~valid
        estimate = float(np.sum(values[valid_cells], dtype=np.float64)) if np.any(valid_cells) else 0.0
        results.append({
            "radiusM": int(radius),
            "populationEstimate": estimate,
            "candidateCellCount": int(np.count_nonzero(candidate)),
            "validPopulationCellCount": int(np.count_nonzero(valid_cells)),
            "noDataPopulationCellCount": int(np.count_nonzero(nodata_cells)),
            "extentFullyCovered": bool(window.fully_covered),
            "status": "complete" if window.fully_covered else "partial_source_coverage",
        })
    return results


@dataclass
class DijkstraResult:
    costs: np.ndarray
    valid: np.ndarray
    window: RasterWindow
    gt: tuple[float, float, float, float, float, float]
    reached_count: int
    max_reached_minutes: float
    search_truncated: bool
    source_boundary_reached: bool


def site_pixel_in_window(ds: gdal.Dataset, window: RasterWindow, lon: float, lat: float) -> tuple[int, int]:
    srs = spatial_ref(ds)
    tx = transformer(wgs84_srs(), srs)
    x, y = transform_point(tx, lon, lat)
    inv_gt = invert_geotransform(geotransform(ds))
    col_f, row_f = world_to_pixel(inv_gt, x, y)
    col = int(math.floor(col_f)) - window.xoff
    row = int(math.floor(row_f)) - window.yoff
    if row < 0 or col < 0 or row >= window.height or col >= window.width:
        fail("GRID3_SITE_OUTSIDE_FRICTION_WINDOW")
    return row, col


def dijkstra_cost_surface(
    friction_ds: gdal.Dataset,
    lon: float,
    lat: float,
    max_threshold_minutes: float,
    max_search_radius_m: int,
) -> DijkstraResult:
    window = bounded_window_around_radius(friction_ds, lon, lat, float(max_search_radius_m))
    band = friction_ds.GetRasterBand(1)
    no_data = band.GetNoDataValue()
    friction = band.ReadAsArray(window.xoff, window.yoff, window.width, window.height).astype(np.float64)
    valid = valid_mask(friction, no_data, positive=True)
    gt = sub_geotransform(geotransform(friction_ds), window)
    start_row, start_col = site_pixel_in_window(friction_ds, window, lon, lat)
    if not valid[start_row, start_col]:
        fail("GRID3_SITE_FRICTION_CELL_UNAVAILABLE")

    step_x = math.hypot(gt[1], gt[4])
    step_y = math.hypot(gt[2], gt[5])
    if step_x <= 0 or step_y <= 0:
        fail("GRID3_FRICTION_PIXEL_SIZE_INVALID")
    diagonal = math.hypot(step_x, step_y)
    neighbors = [
        (-1, -1, diagonal), (-1, 0, step_y), (-1, 1, diagonal),
        (0, -1, step_x), (0, 1, step_x),
        (1, -1, diagonal), (1, 0, step_y), (1, 1, diagonal),
    ]

    costs = np.full(friction.shape, np.inf, dtype=np.float64)
    costs[start_row, start_col] = 0.0
    queue: list[tuple[float, int, int]] = [(0.0, start_row, start_col)]
    reached = 0
    max_reached = 0.0
    configured_boundary_reached = False
    source_boundary_reached = False

    while queue:
        current_cost, row, col = heapq.heappop(queue)
        if current_cost != costs[row, col]:
            continue
        if current_cost > max_threshold_minutes:
            break
        reached += 1
        max_reached = max(max_reached, current_cost)
        if row == 0 or col == 0 or row == window.height - 1 or col == window.width - 1:
            if window.fully_covered:
                configured_boundary_reached = True
            else:
                source_boundary_reached = True
        current_friction = float(friction[row, col])
        for drow, dcol, step_distance in neighbors:
            nrow = row + drow
            ncol = col + dcol
            if nrow < 0 or ncol < 0 or nrow >= window.height or ncol >= window.width:
                continue
            if not valid[nrow, ncol]:
                continue
            neighbor_friction = float(friction[nrow, ncol])
            edge_cost = ((current_friction + neighbor_friction) / 2.0) * step_distance
            candidate = current_cost + edge_cost
            if candidate > max_threshold_minutes or candidate >= costs[nrow, ncol]:
                continue
            costs[nrow, ncol] = candidate
            heapq.heappush(queue, (candidate, nrow, ncol))

    return DijkstraResult(
        costs=costs,
        valid=valid,
        window=window,
        gt=gt,
        reached_count=reached,
        max_reached_minutes=max_reached,
        search_truncated=configured_boundary_reached,
        source_boundary_reached=source_boundary_reached,
    )


def warp_cost_to_population(
    friction_ds: gdal.Dataset,
    result: DijkstraResult,
    pop_ds: gdal.Dataset,
    pop_window: RasterWindow,
) -> np.ndarray:
    driver = gdal.GetDriverByName("MEM")
    source = driver.Create("", result.window.width, result.window.height, 1, gdal.GDT_Float64)
    if source is None:
        fail("GRID3_COST_MEM_RASTER_CREATE_FAILED")
    source.SetGeoTransform(result.gt)
    source.SetProjection(friction_ds.GetProjectionRef())
    source_band = source.GetRasterBand(1)
    cost_values = np.where(np.isfinite(result.costs), result.costs, -9999.0)
    source_band.WriteArray(cost_values)
    source_band.SetNoDataValue(-9999.0)

    pop_gt = sub_geotransform(geotransform(pop_ds), pop_window)
    target = driver.Create("", pop_window.width, pop_window.height, 1, gdal.GDT_Float64)
    if target is None:
        fail("GRID3_POP_COST_MEM_RASTER_CREATE_FAILED")
    target.SetGeoTransform(pop_gt)
    target.SetProjection(pop_ds.GetProjectionRef())
    target_band = target.GetRasterBand(1)
    target_band.Fill(-9999.0)
    target_band.SetNoDataValue(-9999.0)

    error = gdal.ReprojectImage(source, target, friction_ds.GetProjectionRef(), pop_ds.GetProjectionRef(), gdal.GRA_NearestNeighbour)
    if error != 0:
        fail("GRID3_COST_TO_POPULATION_REPROJECT_FAILED", str(error))
    return target_band.ReadAsArray().astype(np.float64)


def accessibility_population_context(
    pop_ds: gdal.Dataset,
    friction_ds: gdal.Dataset,
    lon: float,
    lat: float,
    thresholds: list[int],
    max_search_radius_m: int,
    mode: str,
) -> list[dict[str, Any]]:
    max_threshold = float(max(thresholds))
    traversal = dijkstra_cost_surface(friction_ds, lon, lat, max_threshold, max_search_radius_m)
    pop_window = bounded_window_around_radius(pop_ds, lon, lat, float(max_search_radius_m))
    pop_band = pop_ds.GetRasterBand(1)
    pop_no_data = pop_band.GetNoDataValue()
    population = pop_band.ReadAsArray(pop_window.xoff, pop_window.yoff, pop_window.width, pop_window.height).astype(np.float64)
    pop_valid = valid_mask(population, pop_no_data, positive=False)
    mapped_cost = warp_cost_to_population(friction_ds, traversal, pop_ds, pop_window)
    mapped_available = np.isfinite(mapped_cost) & (mapped_cost >= 0.0) & (mapped_cost != -9999.0)

    results: list[dict[str, Any]] = []
    for threshold in thresholds:
        reachable = pop_valid & mapped_available & (mapped_cost <= float(threshold))
        friction_unavailable = pop_valid & ~mapped_available
        nodata_population = ~pop_valid
        estimate = float(np.sum(population[reachable], dtype=np.float64)) if np.any(reachable) else 0.0
        complete = pop_window.fully_covered and not traversal.source_boundary_reached and not traversal.search_truncated
        threshold_costs = traversal.costs[np.isfinite(traversal.costs) & (traversal.costs <= float(threshold))]
        max_reached_for_threshold = float(np.max(threshold_costs)) if threshold_costs.size else 0.0
        results.append({
            "mode": mode,
            "thresholdMinutes": int(threshold),
            "populationEstimate": estimate,
            "reachablePopulationCellCount": int(np.count_nonzero(reachable)),
            "candidatePopulationCellCount": int(population.size),
            "validPopulationCellCount": int(np.count_nonzero(pop_valid)),
            "noDataPopulationCellCount": int(np.count_nonzero(nodata_population)),
            "frictionUnavailablePopulationCellCount": int(np.count_nonzero(friction_unavailable)),
            "reachedFrictionCellCount": int(threshold_costs.size),
            "maxReachedMinutes": max_reached_for_threshold,
            "populationExtentFullyCovered": bool(pop_window.fully_covered),
            "frictionExtentFullyCovered": bool(traversal.window.fully_covered),
            "searchTruncated": bool(traversal.search_truncated),
            "sourceBoundaryReached": bool(traversal.source_boundary_reached),
            "status": "complete" if complete else "partial_or_truncated",
        })
    return results


def load_sites(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list) or not data:
        fail("GRID3_SITES_REQUIRED")
    sites: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            fail("GRID3_SITE_INVALID")
        for key in ("siteId", "coordinateAssertionId", "longitude", "latitude"):
            if key not in item:
                fail("GRID3_SITE_FIELD_REQUIRED", key)
        lon = float(item["longitude"])
        lat = float(item["latitude"])
        if not finite(lon) or not finite(lat) or lon < -180 or lon > 180 or lat < -90 or lat > 90:
            fail("GRID3_SITE_COORDINATE_INVALID")
        sites.append({
            "siteId": str(item["siteId"]),
            "coordinateAssertionId": str(item["coordinateAssertionId"]),
            "longitude": lon,
            "latitude": lat,
        })
    return sites


def parse_int_list(raw: str, code: str) -> list[int]:
    try:
        values = sorted(set(int(part.strip()) for part in raw.split(",") if part.strip()))
    except ValueError:
        fail(code)
    if not values or any(value <= 0 for value in values):
        fail(code)
    return values


def derive(args: argparse.Namespace) -> dict[str, Any]:
    pop_ds = dataset(args.population)
    walking_ds = dataset(args.walking)
    mixed_ds = dataset(args.mixed)
    sites = load_sites(args.sites_json)
    radii = parse_int_list(args.radii, "GRID3_RADII_INVALID")
    thresholds = parse_int_list(args.thresholds, "GRID3_THRESHOLDS_INVALID")
    max_search_radius_m = int(args.max_search_radius_m)
    if max_search_radius_m <= 0:
        fail("GRID3_MAX_SEARCH_RADIUS_INVALID")

    results: list[dict[str, Any]] = []
    for site in sites:
        lon = site["longitude"]
        lat = site["latitude"]
        population_radius = population_radius_context(pop_ds, lon, lat, radii)
        walking = accessibility_population_context(pop_ds, walking_ds, lon, lat, thresholds, max_search_radius_m, "walking")
        mixed = accessibility_population_context(pop_ds, mixed_ds, lon, lat, thresholds, max_search_radius_m, "mixed")
        results.append({**site, "populationRadius": population_radius, "accessibility": [*walking, *mixed]})

    return {
        "workerVersion": WORKER_VERSION,
        "settings": {
            "radiiM": radii,
            "thresholdsMinutes": thresholds,
            "maxSearchRadiusM": max_search_radius_m,
            "neighborPolicy": "8_neighbor",
            "edgeCostPolicy": "arithmetic_mean_endpoint_friction_minutes_per_meter_times_projected_center_distance_m",
            "populationAggregationPolicy": "full_fractional_population_cell_when_cell_center_qualifies",
            "travelTimePopulationMappingPolicy": "nearest_neighbor_cost_surface_to_population_cell_center",
            "populationRadiusDistancePolicy": "haversine_population_cell_center",
        },
        "rasters": {
            "population": inspect_raster(args.population),
            "walking": inspect_raster(args.walking),
            "mixed": inspect_raster(args.mixed),
        },
        "sites": results,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GRID3 OOH raster accessibility worker")
    sub = parser.add_subparsers(dest="command", required=True)
    inspect_cmd = sub.add_parser("inspect")
    inspect_cmd.add_argument("--input", required=True)
    derive_cmd = sub.add_parser("derive")
    derive_cmd.add_argument("--population", required=True)
    derive_cmd.add_argument("--walking", required=True)
    derive_cmd.add_argument("--mixed", required=True)
    derive_cmd.add_argument("--sites-json", required=True)
    derive_cmd.add_argument("--radii", default="250,500,1000")
    derive_cmd.add_argument("--thresholds", default="5,10,15")
    derive_cmd.add_argument("--max-search-radius-m", default="30000")
    return parser


def main() -> int:
    gdal.UseExceptions()
    args = build_parser().parse_args()
    try:
        output = inspect_raster(args.input) if args.command == "inspect" else derive(args)
        json.dump(output, sys.stdout, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        sys.stdout.write("\n")
        return 0
    except Exception as exc:
        sys.stderr.write(f"grid3-accessibility failed: {exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())