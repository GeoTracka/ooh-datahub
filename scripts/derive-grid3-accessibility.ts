import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { canonicalJson } from "../src/shared/canonicalJson";
import {
  GRID3_ACCESSIBILITY_CONTEXT_VERSION,
  GRID3_DEFAULT_MAX_SEARCH_RADIUS_M,
  GRID3_DEFAULT_RADII_M,
  GRID3_DEFAULT_THRESHOLDS_MINUTES,
  GRID3_RASTER_WORKER_VERSION,
  grid3RasterGridSignature,
  normalizeAccessibilityThresholds,
  normalizeMaxSearchRadius,
  normalizePopulationRadii,
  validateGrid3RasterInspection,
  type RasterInspection,
} from "../src/enrichment/grid3Raster";
import { migrateDatabase } from "./db-migrate";
import { queryJsonRows } from "./data/queryJson";
import { copyStart, copyTextRow, sqlLiteral } from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`GRID3_ACCESSIBILITY_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function shaArg(name: string): string {
  const value = requiredArg(name);
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`INVALID_${name.toUpperCase().replaceAll("-", "_")}`);
  return value;
}

function parseIntList(raw: string | null, defaults: readonly number[], kind: "radii" | "thresholds"): number[] {
  const values = raw
    ? raw.split(",").map((value) => Number(value.trim()))
    : [...defaults];
  return kind === "radii" ? normalizePopulationRadii(values) : normalizeAccessibilityThresholds(values);
}

function jsonSql(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function writeRows(
  session: PsqlSession,
  table: string,
  columns: readonly string[],
  rows: Iterable<readonly unknown[]>,
): Promise<number> {
  await session.write(copyStart(table, columns));
  let count = 0;
  try {
    for (const row of rows) {
      await session.write(copyTextRow(row));
      count += 1;
    }
  } catch (error) {
    await session.write("\\.\n");
    throw error;
  }
  await session.write("\\.\n");
  return count;
}

type ArtifactRow = {
  sourceId: string;
  artifactSha256: string;
  sourceRelease: string;
  fileName: string;
  byteSize: number;
  licenseId: string;
  attributionText: string;
  shareAlike: boolean;
  storageUri: string;
  metadata: Record<string, unknown>;
};

type SiteCoordinate = {
  siteId: string;
  coordinateAssertionId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  sourceKind: string;
  coordinateSourceId: string;
  sourceArtifactId: string | null;
  spatialRights: string;
  spatialLicenseId: string | null;
  enrichmentRevision: string;
};

type WorkerRadiusRow = {
  radiusM: number;
  populationEstimate: number;
  candidateCellCount: number;
  validPopulationCellCount: number;
  noDataPopulationCellCount: number;
  extentFullyCovered: boolean;
  status: "complete" | "partial_source_coverage";
};

type WorkerAccessRow = {
  mode: "walking" | "mixed";
  thresholdMinutes: number;
  populationEstimate: number;
  reachablePopulationCellCount: number;
  candidatePopulationCellCount: number;
  validPopulationCellCount: number;
  noDataPopulationCellCount: number;
  frictionUnavailablePopulationCellCount: number;
  reachedFrictionCellCount: number;
  maxReachedMinutes: number;
  populationExtentFullyCovered: boolean;
  frictionExtentFullyCovered: boolean;
  searchTruncated: boolean;
  sourceBoundaryReached: boolean;
  status: "complete" | "partial_or_truncated";
};

type WorkerOutput = {
  workerVersion: string;
  settings: {
    radiiM: number[];
    thresholdsMinutes: number[];
    maxSearchRadiusM: number;
    neighborPolicy: string;
    edgeCostPolicy: string;
    populationAggregationPolicy: string;
    travelTimePopulationMappingPolicy: string;
    populationRadiusDistancePolicy: string;
  };
  rasters: {
    population: RasterInspection;
    walking: RasterInspection;
    mixed: RasterInspection;
  };
  sites: Array<SiteCoordinate & {
    populationRadius: WorkerRadiusRow[];
    accessibility: WorkerAccessRow[];
  }>;
};

async function artifact(databaseUrl: string, sourceId: string, sha256: string): Promise<ArtifactRow> {
  const rows: ArtifactRow[] = [];
  for await (const row of queryJsonRows<ArtifactRow>(databaseUrl, `
SELECT json_build_object(
  'sourceId', source_id,
  'artifactSha256', artifact_sha256,
  'sourceRelease', source_release,
  'fileName', file_name,
  'byteSize', byte_size,
  'licenseId', license_id,
  'attributionText', attribution_text,
  'shareAlike', share_alike,
  'storageUri', storage_uri,
  'metadata', metadata
)::text
FROM ooh_data.enrichment_artifacts
WHERE source_id=${sqlLiteral(sourceId)} AND artifact_sha256=${sqlLiteral(sha256)};
`)) rows.push(row);
  if (rows.length !== 1) throw new Error(`GRID3_REGISTERED_ARTIFACT_REQUIRED:${sourceId}:${sha256}`);
  return rows[0];
}

async function eligibleCoordinates(databaseUrl: string): Promise<SiteCoordinate[]> {
  const rows: SiteCoordinate[] = [];
  for await (const row of queryJsonRows<SiteCoordinate>(databaseUrl, `
SELECT json_build_object(
  'siteId', c.site_id,
  'coordinateAssertionId', c.assertion_id,
  'latitude', c.latitude,
  'longitude', c.longitude,
  'accuracyM', c.coordinate_accuracy_m,
  'sourceKind', c.source_kind,
  'coordinateSourceId', c.coordinate_source_id,
  'sourceArtifactId', c.source_artifact_id,
  'spatialRights', c.spatial_rights,
  'spatialLicenseId', c.spatial_license_id,
  'enrichmentRevision', c.enrichment_revision
)::text
FROM ooh_data.site_coordinate_assertions c
JOIN ooh_data.site_entities s ON s.site_id=c.site_id
WHERE s.identity_status='confirmed'
  AND c.assertion_status='approved'
  AND c.renderer_eligibility='maplibre'
  AND c.planning_use='context_only'
ORDER BY c.site_id, c.assertion_id;
`)) rows.push(row);
  if (rows.length === 0) throw new Error("GRID3_ACCESSIBILITY_NO_ELIGIBLE_COORDINATES");
  return rows;
}

function rasterMetadata(artifactRow: ArtifactRow): RasterInspection {
  const raster = artifactRow.metadata.raster as RasterInspection | undefined;
  if (!raster) throw new Error(`GRID3_REGISTERED_RASTER_METADATA_REQUIRED:${artifactRow.artifactSha256}`);
  return raster;
}

function productRole(artifactRow: ArtifactRow): string {
  const role = artifactRow.metadata.grid3ProductRole;
  return typeof role === "string" ? role : "";
}

async function invokeWorker(input: {
  populationPath: string;
  walkingPath: string;
  mixedPath: string;
  sitesPath: string;
  radii: number[];
  thresholds: number[];
  maxSearchRadiusM: number;
}): Promise<WorkerOutput> {
  const python = process.env.PYTHON_BIN?.trim() || "python3";
  const worker = resolve("scripts/enrichment/grid3_accessibility.py");
  const args = [
    worker,
    "derive",
    `--population=${input.populationPath}`,
    `--walking=${input.walkingPath}`,
    `--mixed=${input.mixedPath}`,
    `--sites-json=${input.sitesPath}`,
    `--radii=${input.radii.join(",")}`,
    `--thresholds=${input.thresholds.join(",")}`,
    `--max-search-radius-m=${input.maxSearchRadiusM}`,
  ];
  return await new Promise<WorkerOutput>((resolvePromise, reject) => {
    const child = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`GRID3_ACCESSIBILITY_WORKER_FAILED:${code}:${stderr.trim().slice(-4000)}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()) as WorkerOutput);
      } catch {
        reject(new Error("GRID3_ACCESSIBILITY_WORKER_JSON_INVALID"));
      }
    });
  });
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "GRID3_ACCESSIBILITY_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.site_raster_context_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

export async function deriveGrid3Accessibility(): Promise<Record<string, unknown>> {
  const databaseUrl = requiredDatabaseUrl();
  const populationPath = resolve(requiredArg("population"));
  const walkingPath = resolve(requiredArg("walking"));
  const mixedPath = resolve(requiredArg("mixed"));
  const populationSha = shaArg("population-sha");
  const walkingSha = shaArg("walking-sha");
  const mixedSha = shaArg("mixed-sha");
  if (walkingSha === mixedSha) throw new Error("GRID3_WALKING_MIXED_ARTIFACTS_MUST_DIFFER");
  const radii = parseIntList(arg("radii"), GRID3_DEFAULT_RADII_M, "radii");
  const thresholds = parseIntList(arg("thresholds"), GRID3_DEFAULT_THRESHOLDS_MINUTES, "thresholds");
  const maxSearchRadiusM = normalizeMaxSearchRadius(
    arg("max-search-radius-m") ? Number(arg("max-search-radius-m")) : GRID3_DEFAULT_MAX_SEARCH_RADIUS_M,
  );

  await migrateDatabase();
  const runId = randomUUID();
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.site_raster_context_runs (run_id, algorithm_version, status, decision_use)
VALUES (${sqlLiteral(runId)}::uuid, ${sqlLiteral(GRID3_ACCESSIBILITY_CONTEXT_VERSION)}, 'running', 'context_only');
`);

  const tempDir = await mkdtemp(join(tmpdir(), "ooh-grid3-accessibility-"));
  try {
    const localHashes = await Promise.all([
      sha256File(populationPath),
      sha256File(walkingPath),
      sha256File(mixedPath),
    ]);
    if (localHashes[0] !== populationSha) throw new Error("GRID3_POPULATION_LOCAL_HASH_MISMATCH");
    if (localHashes[1] !== walkingSha) throw new Error("GRID3_WALKING_LOCAL_HASH_MISMATCH");
    if (localHashes[2] !== mixedSha) throw new Error("GRID3_MIXED_LOCAL_HASH_MISMATCH");

    const [populationArtifact, walkingArtifact, mixedArtifact, coordinates] = await Promise.all([
      artifact(databaseUrl, "grid3-nigeria-population", populationSha),
      artifact(databaseUrl, "grid3-nigeria-friction", walkingSha),
      artifact(databaseUrl, "grid3-nigeria-friction", mixedSha),
      eligibleCoordinates(databaseUrl),
    ]);
    if (productRole(populationArtifact) !== "population") throw new Error("GRID3_POPULATION_ARTIFACT_ROLE_MISMATCH");
    if (productRole(walkingArtifact) !== "walking_friction") throw new Error("GRID3_WALKING_ARTIFACT_ROLE_MISMATCH");
    if (productRole(mixedArtifact) !== "mixed_friction") throw new Error("GRID3_MIXED_ARTIFACT_ROLE_MISMATCH");

    const populationRaster = rasterMetadata(populationArtifact);
    const walkingRaster = rasterMetadata(walkingArtifact);
    const mixedRaster = rasterMetadata(mixedArtifact);
    validateGrid3RasterInspection("population", populationRaster);
    validateGrid3RasterInspection("walking_friction", walkingRaster);
    validateGrid3RasterInspection("mixed_friction", mixedRaster);
    const walkingGrid = grid3RasterGridSignature(walkingRaster);
    const mixedGrid = grid3RasterGridSignature(mixedRaster);
    if (walkingGrid !== mixedGrid) throw new Error("GRID3_FRICTION_GRID_SIGNATURE_MISMATCH");

    const sitesPath = join(tempDir, "sites.json");
    await writeFile(sitesPath, JSON.stringify(coordinates), "utf8");
    const worker = await invokeWorker({
      populationPath,
      walkingPath,
      mixedPath,
      sitesPath,
      radii,
      thresholds,
      maxSearchRadiusM,
    });
    if (worker.workerVersion !== GRID3_RASTER_WORKER_VERSION) {
      throw new Error(`GRID3_ACCESSIBILITY_WORKER_VERSION_MISMATCH:${worker.workerVersion}`);
    }
    if (canonicalJson(worker.settings.radiiM) !== canonicalJson(radii)
      || canonicalJson(worker.settings.thresholdsMinutes) !== canonicalJson(thresholds)
      || worker.settings.maxSearchRadiusM !== maxSearchRadiusM) {
      throw new Error("GRID3_ACCESSIBILITY_WORKER_SETTINGS_MISMATCH");
    }
    validateGrid3RasterInspection("population", worker.rasters.population);
    validateGrid3RasterInspection("walking_friction", worker.rasters.walking);
    validateGrid3RasterInspection("mixed_friction", worker.rasters.mixed);
    if (grid3RasterGridSignature(worker.rasters.walking) !== walkingGrid
      || grid3RasterGridSignature(worker.rasters.mixed) !== mixedGrid) {
      throw new Error("GRID3_ACCESSIBILITY_WORKER_GRID_MISMATCH");
    }

    const workerCoordinateKeys = worker.sites.map((site) => `${site.siteId}|${site.coordinateAssertionId}`).sort();
    const expectedCoordinateKeys = coordinates.map((site) => `${site.siteId}|${site.coordinateAssertionId}`).sort();
    if (canonicalJson(workerCoordinateKeys) !== canonicalJson(expectedCoordinateKeys)) {
      throw new Error("GRID3_ACCESSIBILITY_WORKER_COORDINATE_SET_MISMATCH");
    }
    const truncated = worker.sites.flatMap((site) => site.accessibility).filter((row) => row.searchTruncated);
    if (truncated.length > 0) throw new Error(`GRID3_ACCESSIBILITY_SEARCH_TRUNCATED:${truncated.length}`);

    const sourceManifest = {
      artifacts: {
        population: populationArtifact,
        walking: walkingArtifact,
        mixed: mixedArtifact,
      },
      coordinates,
      worker: {
        version: worker.workerVersion,
        settings: worker.settings,
      },
    };
    const inputFingerprint = createHash("sha256").update(canonicalJson({
      algorithmVersion: GRID3_ACCESSIBILITY_CONTEXT_VERSION,
      sourceManifest,
    }), "utf8").digest("hex");
    const snapshotId = `rasterctx:${inputFingerprint}`;

    const radiusRows = worker.sites.flatMap((site) => site.populationRadius.map((row) => [
      snapshotId,
      site.siteId,
      site.coordinateAssertionId,
      row.radiusM,
      row.populationEstimate,
      row.candidateCellCount,
      row.validPopulationCellCount,
      row.noDataPopulationCellCount,
      row.extentFullyCovered,
      row.extentFullyCovered ? "complete" : "partial_source_coverage",
      "context_only",
    ]));
    const accessRows = worker.sites.flatMap((site) => site.accessibility.map((row) => [
      snapshotId,
      site.siteId,
      site.coordinateAssertionId,
      row.mode,
      row.thresholdMinutes,
      row.populationEstimate,
      row.reachablePopulationCellCount,
      row.candidatePopulationCellCount,
      row.validPopulationCellCount,
      row.noDataPopulationCellCount,
      row.frictionUnavailablePopulationCellCount,
      row.reachedFrictionCellCount,
      row.maxReachedMinutes,
      row.populationExtentFullyCovered,
      row.frictionExtentFullyCovered,
      false,
      row.sourceBoundaryReached,
      row.populationExtentFullyCovered && row.frictionExtentFullyCovered && !row.sourceBoundaryReached
        ? "complete" : "partial_source_coverage",
      "context_only",
    ]));

    const session = startPsql(databaseUrl);
    try {
      await session.write(`\\set ON_ERROR_STOP on\nBEGIN;\n`);
      await session.write(`
INSERT INTO ooh_data.site_raster_context_snapshots (
  snapshot_id, algorithm_version, input_fingerprint,
  population_source_id, population_artifact_sha256,
  walking_source_id, walking_artifact_sha256,
  mixed_source_id, mixed_artifact_sha256,
  radii_m, thresholds_minutes, max_search_radius_m,
  first_context_run_id, decision_use
) VALUES (
  ${sqlLiteral(snapshotId)}, ${sqlLiteral(GRID3_ACCESSIBILITY_CONTEXT_VERSION)}, ${sqlLiteral(inputFingerprint)},
  'grid3-nigeria-population', ${sqlLiteral(populationSha)},
  'grid3-nigeria-friction', ${sqlLiteral(walkingSha)},
  'grid3-nigeria-friction', ${sqlLiteral(mixedSha)},
  ARRAY[${radii.join(",")}]::integer[], ARRAY[${thresholds.join(",")}]::integer[], ${maxSearchRadiusM},
  ${sqlLiteral(runId)}::uuid, 'context_only'
)
ON CONFLICT (algorithm_version, input_fingerprint) DO NOTHING;

CREATE TEMP TABLE incoming_population_radius (LIKE ooh_data.site_population_radius_context INCLUDING DEFAULTS) ON COMMIT DROP;
`);
      await writeRows(session, "incoming_population_radius", [
        "snapshot_id", "site_id", "coordinate_assertion_id", "radius_m", "population_estimate",
        "candidate_cell_count", "valid_population_cell_count", "nodata_population_cell_count",
        "extent_fully_covered", "coverage_status", "decision_use",
      ], radiusRows);
      await session.write(`
INSERT INTO ooh_data.site_population_radius_context
SELECT * FROM incoming_population_radius
ON CONFLICT (snapshot_id, site_id, coordinate_assertion_id, radius_m) DO NOTHING;

CREATE TEMP TABLE incoming_accessible_population (LIKE ooh_data.site_accessible_population_context INCLUDING DEFAULTS) ON COMMIT DROP;
`);
      await writeRows(session, "incoming_accessible_population", [
        "snapshot_id", "site_id", "coordinate_assertion_id", "access_mode", "threshold_minutes",
        "population_estimate", "reachable_population_cell_count", "candidate_population_cell_count",
        "valid_population_cell_count", "nodata_population_cell_count", "friction_unavailable_population_cell_count",
        "reached_friction_cell_count", "max_reached_minutes", "population_extent_fully_covered",
        "friction_extent_fully_covered", "search_truncated", "source_boundary_reached", "coverage_status", "decision_use",
      ], accessRows);
      await session.write(`
INSERT INTO ooh_data.site_accessible_population_context
SELECT * FROM incoming_accessible_population
ON CONFLICT (snapshot_id, site_id, coordinate_assertion_id, access_mode, threshold_minutes) DO NOTHING;

UPDATE ooh_data.site_raster_context_runs
SET status='succeeded',
    source_manifest=${jsonSql(sourceManifest)},
    input_fingerprint=${sqlLiteral(inputFingerprint)},
    snapshot_id=${sqlLiteral(snapshotId)},
    completed_at=now(),
    counts=${jsonSql({
      eligibleCoordinateAssertions: coordinates.length,
      radiusRows: radiusRows.length,
      accessibilityRows: accessRows.length,
      radiiM: radii,
      thresholdsMinutes: thresholds,
      maxSearchRadiusM,
      partialRadiusRows: worker.sites.flatMap((site) => site.populationRadius).filter((row) => !row.extentFullyCovered).length,
      partialAccessibilityRows: worker.sites.flatMap((site) => site.accessibility).filter((row) => row.sourceBoundaryReached || !row.populationExtentFullyCovered || !row.frictionExtentFullyCovered).length,
    })}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
COMMIT;
`);
      await session.finish();
    } catch (error) {
      try { await session.write("ROLLBACK;\n"); } catch { /* session may be closed */ }
      try { await session.finish(); } catch { /* preserve original error */ }
      throw error;
    }

    return {
      runId,
      snapshotId,
      inputFingerprint,
      counts: {
        eligibleCoordinateAssertions: coordinates.length,
        radiusRows: radiusRows.length,
        accessibilityRows: accessRows.length,
      },
    };
  } catch (error) {
    try { await markFailed(databaseUrl, runId, error); } catch { /* preserve original error */ }
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

deriveGrid3Accessibility()
  .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`data:derive:accessibility failed: ${message}\n`);
    process.exitCode = 1;
  });
