#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any

from osgeo import gdal, ogr, osr

WORKER_VERSION = "grid3-settlement-worker-v1"


def fail(code: str, detail: str | None = None) -> None:
    raise RuntimeError(code if detail is None else f"{code}:{detail}")


def spatial_ref(layer: ogr.Layer) -> osr.SpatialReference:
    srs = layer.GetSpatialRef()
    if srs is None:
        fail("GRID3_SETTLEMENT_CRS_REQUIRED")
    clone = srs.Clone()
    clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return clone


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
    fail("GRID3_SETTLEMENT_EPSG_REQUIRED")


def wgs84() -> osr.SpatialReference:
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def transformer(source: osr.SpatialReference, target: osr.SpatialReference) -> osr.CoordinateTransformation:
    src = source.Clone()
    dst = target.Clone()
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(src, dst)


def transform_point(tx: osr.CoordinateTransformation, x: float, y: float) -> tuple[float, float]:
    result = tx.TransformPoint(float(x), float(y))
    return float(result[0]), float(result[1])


def open_vector(path: str) -> gdal.Dataset:
    ds = gdal.OpenEx(path, gdal.OF_VECTOR | gdal.OF_READONLY)
    if ds is None:
        fail("GRID3_SETTLEMENT_OPEN_FAILED", path)
    return ds


def polygon_layer(ds: gdal.Dataset, requested: str | None) -> ogr.Layer:
    if requested:
        layer = ds.GetLayerByName(requested)
        if layer is None:
            fail("GRID3_SETTLEMENT_LAYER_NOT_FOUND", requested)
        return layer

    candidates: list[ogr.Layer] = []
    for index in range(ds.GetLayerCount()):
        layer = ds.GetLayerByIndex(index)
        if layer is None:
            continue
        geometry_name = ogr.GeometryTypeToName(layer.GetGeomType()).lower()
        if "polygon" in geometry_name:
            candidates.append(layer)
    if not candidates:
        fail("GRID3_SETTLEMENT_POLYGON_LAYER_REQUIRED")
    if len(candidates) > 1:
        fail("GRID3_SETTLEMENT_LAYER_REQUIRED_FOR_MULTI_LAYER_SOURCE")
    return candidates[0]


def inspect(path: str, requested_layer: str | None) -> dict[str, Any]:
    ds = open_vector(path)
    layer = polygon_layer(ds, requested_layer)
    srs = spatial_ref(layer)
    extent = layer.GetExtent(force=1)
    if extent is None:
        fail("GRID3_SETTLEMENT_EXTENT_REQUIRED")
    min_x, max_x, min_y, max_y = [float(value) for value in extent]
    tx = transformer(srs, wgs84())
    corners = [
        transform_point(tx, min_x, min_y),
        transform_point(tx, min_x, max_y),
        transform_point(tx, max_x, min_y),
        transform_point(tx, max_x, max_y),
    ]
    definition = layer.GetLayerDefn()
    fields = []
    for index in range(definition.GetFieldCount()):
        field = definition.GetFieldDefn(index)
        fields.append({
            "name": field.GetName(),
            "type": field.GetFieldTypeName(field.GetType()),
            "width": int(field.GetWidth()),
            "precision": int(field.GetPrecision()),
        })
    return {
        "workerVersion": WORKER_VERSION,
        "driver": ds.GetDriver().ShortName,
        "layerName": layer.GetName(),
        "featureCount": int(layer.GetFeatureCount(force=1)),
        "geometryType": ogr.GeometryTypeToName(layer.GetGeomType()),
        "epsg": epsg_code(srs),
        "fields": fields,
        "boundsNative": [min_x, min_y, max_x, max_y],
        "boundsWgs84": [
            min(point[0] for point in corners),
            min(point[1] for point in corners),
            max(point[0] for point in corners),
            max(point[1] for point in corners),
        ],
    }


def json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    return str(value)


def feature_properties(feature: ogr.Feature) -> dict[str, Any]:
    definition = feature.GetDefnRef()
    output: dict[str, Any] = {}
    for index in range(definition.GetFieldCount()):
        name = definition.GetFieldDefn(index).GetName()
        output[name] = json_value(feature.GetField(index))
    return output


def numeric(value: Any, semantic: str, feature_id: str, minimum: float = 0.0, maximum: float | None = None) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        fail("GRID3_SETTLEMENT_FIELD_VALUE_INVALID", f"{semantic}:{feature_id}")
    if not math.isfinite(number) or number < minimum or (maximum is not None and number > maximum):
        fail("GRID3_SETTLEMENT_FIELD_VALUE_INVALID", f"{semantic}:{feature_id}")
    return number


def text_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def polygonal_geometry(geometry: ogr.Geometry) -> tuple[ogr.Geometry, bool, bool]:
    original_valid = bool(geometry.IsValid())
    repaired = False
    working = geometry.Clone()
    if not original_valid:
        if not hasattr(working, "MakeValid"):
            fail("GRID3_SETTLEMENT_INVALID_GEOMETRY_UNREPAIRABLE")
        working = working.MakeValid()
        repaired = True
        if working is None or working.IsEmpty():
            fail("GRID3_SETTLEMENT_INVALID_GEOMETRY_UNREPAIRABLE")

    flat_type = ogr.wkbFlatten(working.GetGeometryType())
    if flat_type == ogr.wkbPolygon:
        working = ogr.ForceToMultiPolygon(working)
    elif flat_type == ogr.wkbMultiPolygon:
        pass
    elif flat_type == ogr.wkbGeometryCollection:
        multi = ogr.Geometry(ogr.wkbMultiPolygon)
        for index in range(working.GetGeometryCount()):
            part = working.GetGeometryRef(index)
            if part is None:
                continue
            part_type = ogr.wkbFlatten(part.GetGeometryType())
            if part_type == ogr.wkbPolygon:
                multi.AddGeometry(part)
            elif part_type == ogr.wkbMultiPolygon:
                for child_index in range(part.GetGeometryCount()):
                    child = part.GetGeometryRef(child_index)
                    if child is not None:
                        multi.AddGeometry(child)
        if multi.GetGeometryCount() == 0:
            fail("GRID3_SETTLEMENT_POLYGON_GEOMETRY_REQUIRED")
        working = multi
        repaired = True
    else:
        fail("GRID3_SETTLEMENT_POLYGON_GEOMETRY_REQUIRED")

    if not working.IsValid():
        fail("GRID3_SETTLEMENT_GEOMETRY_REPAIR_FAILED")
    return working, original_valid, repaired


def mapped_value(properties: dict[str, Any], field_map: dict[str, str], semantic: str) -> Any:
    field_name = field_map.get(semantic)
    return None if not field_name else properties.get(field_name)


def export_records(path: str, requested_layer: str | None, field_map_path: str) -> None:
    with open(field_map_path, "r", encoding="utf-8") as handle:
        field_map = json.load(handle)
    if not isinstance(field_map, dict):
        fail("GRID3_SETTLEMENT_FIELD_MAP_OBJECT_REQUIRED")

    ds = open_vector(path)
    layer = polygon_layer(ds, requested_layer)
    source_srs = spatial_ref(layer)
    tx = transformer(source_srs, wgs84())
    layer.ResetReading()

    for feature in layer:
        properties = feature_properties(feature)
        feature_field = str(field_map.get("featureId", "$fid"))
        source_feature_id = feature.GetFID() if feature_field == "$fid" else properties.get(feature_field)
        feature_id = text_value(source_feature_id)
        if feature_id is None:
            fail("GRID3_SETTLEMENT_FEATURE_ID_REQUIRED")

        geometry = feature.GetGeometryRef()
        if geometry is None or geometry.IsEmpty():
            fail("GRID3_SETTLEMENT_GEOMETRY_REQUIRED", feature_id)
        polygon, original_valid, repaired = polygonal_geometry(geometry)
        if polygon.Transform(tx) != 0:
            fail("GRID3_SETTLEMENT_GEOMETRY_TRANSFORM_FAILED", feature_id)
        if polygon.IsEmpty() or not polygon.IsValid():
            fail("GRID3_SETTLEMENT_TRANSFORMED_GEOMETRY_INVALID", feature_id)

        record = {
            "featureId": feature_id,
            "sourceFeatureId": feature_id,
            "originalGeometryValid": original_valid,
            "geometryRepaired": repaired,
            "buildingCount": numeric(mapped_value(properties, field_map, "buildingCount"), "buildingCount", feature_id),
            "buildingDensity": numeric(mapped_value(properties, field_map, "buildingDensity"), "buildingDensity", feature_id),
            "degreeUrbanisation": text_value(mapped_value(properties, field_map, "degreeUrbanisation")),
            "populationEstimate": numeric(mapped_value(properties, field_map, "populationEstimate"), "populationEstimate", feature_id),
            "falsePositiveProbability": numeric(
                mapped_value(properties, field_map, "falsePositiveProbability"),
                "falsePositiveProbability",
                feature_id,
                0.0,
                1.0,
            ),
            "placeCode": text_value(mapped_value(properties, field_map, "placeCode")),
            "rawProperties": properties,
            "geometry": json.loads(polygon.ExportToJson()),
        }
        sys.stdout.write(json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="GRID3 settlement vector worker")
    sub = root.add_subparsers(dest="command", required=True)
    inspect_cmd = sub.add_parser("inspect")
    inspect_cmd.add_argument("--input", required=True)
    inspect_cmd.add_argument("--layer")
    export_cmd = sub.add_parser("export")
    export_cmd.add_argument("--input", required=True)
    export_cmd.add_argument("--layer")
    export_cmd.add_argument("--field-map", required=True)
    return root


def main() -> int:
    gdal.UseExceptions()
    ogr.UseExceptions()
    args = parser().parse_args()
    try:
        if args.command == "inspect":
            json.dump(inspect(args.input, args.layer), sys.stdout, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            sys.stdout.write("\n")
        else:
            export_records(args.input, args.layer, args.field_map)
        return 0
    except Exception as exc:
        sys.stderr.write(f"grid3-settlement failed: {exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
