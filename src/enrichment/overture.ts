import { sourceDisplayLiteral } from "../dataResolution/normalize";

export const OVERTURE_VECTOR_ADAPTER_VERSION = "overture-vector-context-v1";
export const OVERTURE_VECTOR_CONTEXT_VERSION = "overture-site-vector-context-v2";

export type OvertureSourceItem = {
  property?: string | null;
  dataset: string;
  license?: string | null;
  record_id?: string | null;
  update_time?: string | null;
  confidence?: number | null;
  between?: unknown;
  [key: string]: unknown;
};

export type OverturePlaceFeature = {
  featureId: string;
  featureVersion: number;
  name: string | null;
  basicCategory: string | null;
  taxonomy: Record<string, unknown> | null;
  confidence: number | null;
  operatingStatus: "open" | "temporarily_closed" | "permanently_closed" | null;
  sources: OvertureSourceItem[];
  longitude: number;
  latitude: number;
  rawRecord: Record<string, unknown>;
};

export type OvertureRoadFeature = {
  featureId: string;
  featureVersion: number;
  name: string | null;
  roadClass:
    | "motorway" | "trunk" | "primary" | "secondary" | "tertiary"
    | "residential" | "living_street" | "unclassified" | "service"
    | "pedestrian" | "footway" | "steps" | "path" | "track" | "cycleway"
    | "bridleway" | "unknown";
  subclass: string | null;
  connectors: Array<Record<string, unknown>>;
  sources: OvertureSourceItem[];
  coordinates: [number, number][];
  rawRecord: Record<string, unknown>;
};

type GeoJsonFeature = {
  type: "Feature";
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown } | null;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

const roadClasses = new Set<OvertureRoadFeature["roadClass"]>([
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential",
  "living_street", "unclassified", "service", "pedestrian", "footway",
  "steps", "path", "track", "cycleway", "bridleway", "unknown",
]);

const operatingStatuses = new Set<NonNullable<OverturePlaceFeature["operatingStatus"]>>([
  "open", "temporarily_closed", "permanently_closed",
]);

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sourceItems(value: unknown, featureId: string): OvertureSourceItem[] {
  const rows = arrayValue(value).filter((item): item is Record<string, unknown> => (
    Boolean(item) && typeof item === "object" && !Array.isArray(item)
  ));
  if (rows.length === 0) throw new Error(`OVERTURE_SOURCES_REQUIRED:${featureId}`);
  return rows.map((row) => {
    const dataset = sourceDisplayLiteral(row.dataset);
    if (!dataset) throw new Error(`OVERTURE_SOURCE_DATASET_REQUIRED:${featureId}`);
    return {
      ...row,
      dataset,
      property: sourceDisplayLiteral(row.property),
      license: sourceDisplayLiteral(row.license),
      record_id: sourceDisplayLiteral(row.record_id),
      update_time: sourceDisplayLiteral(row.update_time),
      confidence: typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? row.confidence
        : null,
    };
  });
}

function featureId(feature: GeoJsonFeature, properties: Record<string, unknown>): string {
  const id = sourceDisplayLiteral(properties.id ?? feature.id);
  if (!id) throw new Error("OVERTURE_FEATURE_ID_REQUIRED");
  return id;
}

function featureVersion(properties: Record<string, unknown>, id: string): number {
  const version = Number(properties.version);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error(`OVERTURE_FEATURE_VERSION_INVALID:${id}`);
  }
  return version;
}

function parseFeatureCollection(text: string): GeoJsonFeature[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OVERTURE_GEOJSON_INVALID_JSON");
  }
  if (!raw || typeof raw !== "object") throw new Error("OVERTURE_GEOJSON_INVALID_ROOT");
  const root = raw as Partial<GeoJsonFeatureCollection> & Partial<GeoJsonFeature>;
  if (root.type === "FeatureCollection" && Array.isArray(root.features)) return root.features;
  if (root.type === "Feature") return [root as GeoJsonFeature];
  throw new Error("OVERTURE_GEOJSON_FEATURE_COLLECTION_REQUIRED");
}

function pointCoordinates(feature: GeoJsonFeature, id: string): [number, number] {
  if (feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) {
    throw new Error(`OVERTURE_PLACE_POINT_REQUIRED:${id}`);
  }
  const [longitude, latitude] = feature.geometry.coordinates;
  if (
    typeof longitude !== "number" || typeof latitude !== "number"
    || !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
  ) {
    throw new Error(`OVERTURE_PLACE_COORDINATE_INVALID:${id}`);
  }
  return [longitude, latitude];
}

function lineCoordinates(feature: GeoJsonFeature, id: string): [number, number][] {
  if (feature.geometry?.type !== "LineString" || !Array.isArray(feature.geometry.coordinates)) {
    throw new Error(`OVERTURE_ROAD_LINESTRING_REQUIRED:${id}`);
  }
  const coordinates: [number, number][] = [];
  for (const raw of feature.geometry.coordinates) {
    if (!Array.isArray(raw) || raw.length < 2) throw new Error(`OVERTURE_ROAD_COORDINATE_INVALID:${id}`);
    const [longitude, latitude] = raw;
    if (
      typeof longitude !== "number" || typeof latitude !== "number"
      || !Number.isFinite(longitude) || !Number.isFinite(latitude)
      || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
    ) {
      throw new Error(`OVERTURE_ROAD_COORDINATE_INVALID:${id}`);
    }
    coordinates.push([longitude, latitude]);
  }
  if (coordinates.length < 2) throw new Error(`OVERTURE_ROAD_LINESTRING_TOO_SHORT:${id}`);
  return coordinates;
}

export function parseOverturePlacesGeoJson(text: string): OverturePlaceFeature[] {
  const results: OverturePlaceFeature[] = [];
  const seen = new Set<string>();
  for (const feature of parseFeatureCollection(text)) {
    const properties = feature.properties ?? {};
    const id = featureId(feature, properties);
    if (seen.has(id)) throw new Error(`OVERTURE_DUPLICATE_PLACE:${id}`);
    seen.add(id);
    const [longitude, latitude] = pointCoordinates(feature, id);
    const confidence = typeof properties.confidence === "number" && Number.isFinite(properties.confidence)
      ? properties.confidence
      : null;
    if (confidence !== null && (confidence < 0 || confidence > 1)) {
      throw new Error(`OVERTURE_PLACE_CONFIDENCE_INVALID:${id}`);
    }
    const rawStatus = sourceDisplayLiteral(properties.operating_status)?.toLowerCase() ?? null;
    const operatingStatus = rawStatus && operatingStatuses.has(rawStatus as NonNullable<OverturePlaceFeature["operatingStatus"]>)
      ? rawStatus as NonNullable<OverturePlaceFeature["operatingStatus"]>
      : null;
    results.push({
      featureId: id,
      featureVersion: featureVersion(properties, id),
      name: sourceDisplayLiteral(properties.name),
      basicCategory: sourceDisplayLiteral(properties.basic_category),
      taxonomy: objectValue(properties.taxonomy),
      confidence,
      operatingStatus,
      sources: sourceItems(properties.sources, id),
      longitude,
      latitude,
      rawRecord: { type: feature.type, id: feature.id ?? null, properties, geometry: feature.geometry },
    });
  }
  results.sort((a, b) => a.featureId.localeCompare(b.featureId));
  return results;
}

export function parseOvertureRoadsGeoJson(text: string): OvertureRoadFeature[] {
  const results: OvertureRoadFeature[] = [];
  const seen = new Set<string>();
  for (const feature of parseFeatureCollection(text)) {
    const properties = feature.properties ?? {};
    const id = featureId(feature, properties);
    if (seen.has(id)) throw new Error(`OVERTURE_DUPLICATE_ROAD:${id}`);
    seen.add(id);
    const rawClass = sourceDisplayLiteral(properties.class)?.toLowerCase() ?? "unknown";
    if (!roadClasses.has(rawClass as OvertureRoadFeature["roadClass"])) {
      throw new Error(`OVERTURE_ROAD_CLASS_INVALID:${id}:${rawClass}`);
    }
    results.push({
      featureId: id,
      featureVersion: featureVersion(properties, id),
      name: sourceDisplayLiteral(properties.name),
      roadClass: rawClass as OvertureRoadFeature["roadClass"],
      subclass: sourceDisplayLiteral(properties.subclass),
      connectors: arrayValue(properties.connectors).filter((item): item is Record<string, unknown> => (
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )),
      sources: sourceItems(properties.sources, id),
      coordinates: lineCoordinates(feature, id),
      rawRecord: { type: feature.type, id: feature.id ?? null, properties, geometry: feature.geometry },
    });
  }
  results.sort((a, b) => a.featureId.localeCompare(b.featureId));
  return results;
}

export function sourceLicenseCoverage(sources: readonly OvertureSourceItem[]): {
  sourceCount: number;
  licensedSourceCount: number;
  missingLicenseCount: number;
} {
  const licensedSourceCount = sources.filter((source) => Boolean(source.license)).length;
  return {
    sourceCount: sources.length,
    licensedSourceCount,
    missingLicenseCount: sources.length - licensedSourceCount,
  };
}
