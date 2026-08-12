export type MapCoordinate = readonly [longitude: number, latitude: number];

export type MapCameraRequest = {
  mode: "overview" | "selected";
  revision: number;
};

export type PackageCameraTarget =
  | {
      kind: "center";
      center: MapCoordinate;
      zoom: number;
    }
  | {
      kind: "bounds";
      bounds: readonly [MapCoordinate, MapCoordinate];
    };

export const LAGOS_PACKAGE_OVERVIEW = {
  center: [3.39, 6.53] as const,
  zoom: 10.5,
};

const SINGLE_LOCATION_ZOOM = 12.5;
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
const WEB_MERCATOR_TILE_SIZE = 256;
const MAX_CAMERA_ZOOM = 21;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function projectedY(latitude: number): number {
  const radians = clamp(
    latitude,
    -WEB_MERCATOR_MAX_LATITUDE,
    WEB_MERCATOR_MAX_LATITUDE,
  ) * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + (1 / Math.cos(radians))) / Math.PI) / 2;
}

function latitudeFromProjectedY(y: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - (2 * y)))) * 180 / Math.PI;
}

export function fitWebMercatorBoundsCamera(
  bounds: readonly [MapCoordinate, MapCoordinate],
  viewport: { width: number; height: number },
  padding: number,
): { center: MapCoordinate; zoom: number } {
  const firstLongitude = clamp(bounds[0][0], -180, 180);
  const secondLongitude = clamp(bounds[1][0], -180, 180);
  const firstLatitude = clamp(
    bounds[0][1],
    -WEB_MERCATOR_MAX_LATITUDE,
    WEB_MERCATOR_MAX_LATITUDE,
  );
  const secondLatitude = clamp(
    bounds[1][1],
    -WEB_MERCATOR_MAX_LATITUDE,
    WEB_MERCATOR_MAX_LATITUDE,
  );
  const west = Math.min(firstLongitude, secondLongitude);
  const east = Math.max(firstLongitude, secondLongitude);
  const south = Math.min(firstLatitude, secondLatitude);
  const north = Math.max(firstLatitude, secondLatitude);
  const westX = (west + 180) / 360;
  const eastX = (east + 180) / 360;
  const northY = projectedY(north);
  const southY = projectedY(south);
  const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
  const safeWidth = Number.isFinite(viewport.width) ? Math.max(1, viewport.width) : 1;
  const safeHeight = Number.isFinite(viewport.height) ? Math.max(1, viewport.height) : 1;
  const availableWidth = Math.max(1, safeWidth - (safePadding * 2));
  const availableHeight = Math.max(1, safeHeight - (safePadding * 2));
  const longitudeSpan = eastX - westX;
  const latitudeSpan = southY - northY;
  const longitudeZoom = longitudeSpan === 0
    ? Number.POSITIVE_INFINITY
    : Math.log2(availableWidth / (WEB_MERCATOR_TILE_SIZE * longitudeSpan));
  const latitudeZoom = latitudeSpan === 0
    ? Number.POSITIVE_INFINITY
    : Math.log2(availableHeight / (WEB_MERCATOR_TILE_SIZE * latitudeSpan));
  const rawZoom = Math.min(longitudeZoom, latitudeZoom);
  const zoom = Number.isFinite(rawZoom)
    ? clamp(rawZoom, 0, MAX_CAMERA_ZOOM)
    : MAX_CAMERA_ZOOM;
  const centerX = (westX + eastX) / 2;
  const centerY = (northY + southY) / 2;

  return {
    center: [
      clamp((centerX * 360) - 180, -180, 180),
      clamp(
        latitudeFromProjectedY(centerY),
        -WEB_MERCATOR_MAX_LATITUDE,
        WEB_MERCATOR_MAX_LATITUDE,
      ),
    ],
    zoom,
  };
}

export function resolvePackageCameraTarget(
  coordinates: readonly MapCoordinate[],
): PackageCameraTarget {
  if (coordinates.length === 0) {
    return {
      kind: "center",
      center: LAGOS_PACKAGE_OVERVIEW.center,
      zoom: LAGOS_PACKAGE_OVERVIEW.zoom,
    };
  }

  if (coordinates.length === 1) {
    return {
      kind: "center",
      center: coordinates[0],
      zoom: SINGLE_LOCATION_ZOOM,
    };
  }

  let minimumLongitude = coordinates[0][0];
  let maximumLongitude = coordinates[0][0];
  let minimumLatitude = coordinates[0][1];
  let maximumLatitude = coordinates[0][1];

  for (const [longitude, latitude] of coordinates.slice(1)) {
    minimumLongitude = Math.min(minimumLongitude, longitude);
    maximumLongitude = Math.max(maximumLongitude, longitude);
    minimumLatitude = Math.min(minimumLatitude, latitude);
    maximumLatitude = Math.max(maximumLatitude, latitude);
  }

  return {
    kind: "bounds",
    bounds: [
      [minimumLongitude, minimumLatitude],
      [maximumLongitude, maximumLatitude],
    ],
  };
}
