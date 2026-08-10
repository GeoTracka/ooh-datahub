import { normalizeEntityLiteral, sourceDisplayLiteral } from "../dataResolution/normalize";

export const OSM_ADVERTISING_ADAPTER_VERSION = "osm-advertising-v1";

export type GeoJsonGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
};

export type OsmAdvertisingCandidate = {
  osmType: "node" | "way" | "relation" | "unknown";
  osmId: string;
  geometryType: string;
  latitude: number | null;
  longitude: number | null;
  representativeMethod: "point" | "vertex_mean" | "unavailable";
  advertisingType: string;
  operatorName: string | null;
  sourceRef: string | null;
  displaySurface: string | null;
  orientation: string | null;
  direction: string | null;
  sizeText: string | null;
  heightText: string | null;
  lit: string | null;
  luminous: string | null;
  animated: string | null;
  sides: string | null;
  visibility: string | null;
  message: string | null;
  tags: Record<string, unknown>;
  geometry: GeoJsonGeometry;
};

type GeoJsonFeature = {
  type: "Feature";
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: GeoJsonGeometry | null;
};

const acceptedAdvertisingTypes = new Set(["billboard", "screen", "board", "totem"]);

function tagText(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const text = sourceDisplayLiteral(tags[key]);
    if (text) return text;
  }
  return null;
}

function osmIdentity(feature: GeoJsonFeature, tags: Record<string, unknown>): {
  osmType: OsmAdvertisingCandidate["osmType"];
  osmId: string;
} {
  const attributeType = sourceDisplayLiteral(tags["@type"])?.toLowerCase();
  const attributeId = sourceDisplayLiteral(tags["@id"]);
  if (attributeId && (attributeType === "node" || attributeType === "way" || attributeType === "relation")) {
    return { osmType: attributeType, osmId: attributeId };
  }

  const raw = sourceDisplayLiteral(tags["@id"] ?? feature.id);
  if (!raw) throw new Error("OSM_ADVERTISING_ID_REQUIRED");
  const match = /^(node|way|relation)[/:](.+)$/i.exec(raw);
  if (match) {
    return {
      osmType: match[1].toLowerCase() as "node" | "way" | "relation",
      osmId: match[2],
    };
  }
  return { osmType: "unknown", osmId: raw };
}

function collectPositions(value: unknown, positions: [number, number][]): void {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2
    && typeof value[0] === "number"
    && typeof value[1] === "number"
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
  ) {
    positions.push([value[0], value[1]]);
    return;
  }
  for (const child of value) collectPositions(child, positions);
}

function representativePoint(geometry: GeoJsonGeometry): {
  latitude: number | null;
  longitude: number | null;
  method: "point" | "vertex_mean" | "unavailable";
} {
  if (
    geometry.type === "Point"
    && Array.isArray(geometry.coordinates)
    && typeof geometry.coordinates[0] === "number"
    && typeof geometry.coordinates[1] === "number"
    && Number.isFinite(geometry.coordinates[0])
    && Number.isFinite(geometry.coordinates[1])
  ) {
    return { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1], method: "point" };
  }
  const positions: [number, number][] = [];
  collectPositions(geometry.coordinates, positions);
  for (const child of geometry.geometries ?? []) collectPositions(child.coordinates, positions);
  if (positions.length === 0) return { latitude: null, longitude: null, method: "unavailable" };
  const totals = positions.reduce(
    (sum, [longitude, latitude]) => ({ longitude: sum.longitude + longitude, latitude: sum.latitude + latitude }),
    { longitude: 0, latitude: 0 },
  );
  return {
    longitude: totals.longitude / positions.length,
    latitude: totals.latitude / positions.length,
    method: "vertex_mean",
  };
}

export function normalizeOsmAdvertisingFeature(raw: unknown): OsmAdvertisingCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const feature = raw as GeoJsonFeature;
  if (feature.type !== "Feature" || !feature.geometry) return null;
  const tags = { ...(feature.properties ?? {}) };
  const advertising = normalizeEntityLiteral(tags.advertising)?.replaceAll(" ", "_") ?? null;
  const manMade = normalizeEntityLiteral(tags.man_made)?.replaceAll(" ", "_") ?? null;
  const advertisingType = advertising && acceptedAdvertisingTypes.has(advertising)
    ? advertising
    : manMade === "advertising"
      ? "advertising"
      : null;
  if (!advertisingType) return null;

  const identity = osmIdentity(feature, tags);
  const point = representativePoint(feature.geometry);
  return {
    ...identity,
    geometryType: feature.geometry.type,
    latitude: point.latitude,
    longitude: point.longitude,
    representativeMethod: point.method,
    advertisingType,
    operatorName: tagText(tags, "operator", "brand"),
    sourceRef: tagText(tags, "ref", "operator:ref"),
    displaySurface: tagText(tags, "display_surface"),
    orientation: tagText(tags, "orientation"),
    direction: tagText(tags, "direction"),
    sizeText: tagText(tags, "size"),
    heightText: tagText(tags, "height"),
    lit: tagText(tags, "lit"),
    luminous: tagText(tags, "luminous"),
    animated: tagText(tags, "animated"),
    sides: tagText(tags, "sides"),
    visibility: tagText(tags, "visibility"),
    message: tagText(tags, "message"),
    tags,
    geometry: feature.geometry,
  };
}

export function parseOsmAdvertisingGeoJsonSequence(text: string): OsmAdvertisingCandidate[] {
  const rows: OsmAdvertisingCandidate[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/^\u001e/u, "").trim();
    if (!line) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`OSM_GEOJSONSEQ_INVALID_JSON:${index + 1}`);
    }
    const candidate = normalizeOsmAdvertisingFeature(raw);
    if (!candidate) continue;
    const key = `${candidate.osmType}:${candidate.osmId}`;
    if (seen.has(key)) throw new Error(`OSM_ADVERTISING_DUPLICATE:${key}`);
    seen.add(key);
    rows.push(candidate);
  }
  rows.sort((left, right) => {
    const leftKey = `${left.osmType}:${left.osmId}`;
    const rightKey = `${right.osmType}:${right.osmId}`;
    return leftKey.localeCompare(rightKey);
  });
  return rows;
}

export function haversineDistanceM(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusM = 6_371_008.8;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)));
}
