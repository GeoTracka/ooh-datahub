"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EnrichmentRow,
  EnrichmentSnapshot,
  GeocodeResponse,
} from "@/contracts/enrichment";
import type { SpatialFeature } from "@/contracts/renderer";
import {
  applyUploadToDraft,
  confirmGeocodeIdentity,
  correctCoordinate,
  createLocalEnrichmentSnapshot,
  mergeProviderResponses,
  type UploadPlanningDraft,
} from "@/enrichment/enrichmentSnapshot";
import { requestPreflight, runEnrichment } from "@/enrichment/enrichmentClient";
import { mapHeaders, type CanonicalHeader } from "@/import/mapHeaders";
import { readLocalSpreadsheet, type LocalSheet } from "@/import/readLocalSpreadsheet";
import {
  selectRowsForEnrichment,
  validateMappedRows,
  type MappedInventoryRow,
  type ValidatedInventoryRow,
} from "@/import/validateRows";
import { UploadPreview } from "@/features/UploadPreview";
import { MapCanvas } from "@/maps/MapCanvas";
import {
  projectGoogleScene,
  projectMapLibreScene,
} from "@/maps/projectScene";

type HeaderMapping = ReturnType<typeof mapHeaders>[number];

const mappingOptions: CanonicalHeader[] = [
  "assetId",
  "address",
  "latitude",
  "longitude",
  "coordinateAccuracyM",
  "supplier",
  "format",
  "rate",
  "orientation",
  "spatialRights",
  "spatialLicenseId",
  "sourceArtifactId",
  "personName",
];

const mappingLabels: Record<CanonicalHeader, string> = {
  assetId: "Asset / site ID",
  address: "Site address",
  latitude: "Latitude",
  longitude: "Longitude",
  coordinateAccuracyM: "Coordinate accuracy (metres)",
  supplier: "Supplier",
  format: "Media format",
  rate: "Indicative rate (NGN)",
  orientation: "Orientation",
  spatialRights: "Location data rights",
  spatialLicenseId: "Location licence ID",
  sourceArtifactId: "Source file / record ID",
  personName: "Contact / person name",
};

function uploadErrorMessage(code: string): string {
  if (code === "SELECT_AT_LEAST_ONE_ROW") return "Choose at least one accepted row first.";
  if (code === "PREFLIGHT_REQUIRED") return "Review enrichment before starting a provider lookup.";
  if (code === "CORRECTION_COORDINATE_REQUIRED") return "Enter both latitude and longitude for the corrected location.";
  if (code === "CORRECTION_COORDINATE_INVALID") return "Enter a valid latitude and longitude.";
  if (code.includes("UNAUTHORIZED") || code.includes("GRANT")) {
    return "Live enrichment is not authorized for this session. Uploaded facts still work offline.";
  }
  if (code.includes("QUOTA")) {
    return "The live enrichment allowance is exhausted. Uploaded facts still work offline.";
  }
  return "This step could not be completed. Uploaded facts remain usable offline.";
}

function valueFor(target: string, value: unknown): unknown {
  if (["latitude", "longitude", "coordinateAccuracyM", "rate"].includes(target)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return typeof value === "string" ? value.trim() : String(value ?? "");
}

function headerMappingsFor(sheet: LocalSheet): HeaderMapping[] {
  const headers = (sheet.rows[0] ?? []).map((value) => String(value ?? ""));
  return mapHeaders(headers);
}

function mapSheet(
  sheet: LocalSheet,
  mappings: HeaderMapping[],
): MappedInventoryRow[] {
  return sheet.rows.slice(1).map((values) => {
    const row: MappedInventoryRow = { extras: {} };
    mappings.forEach((mapping, index) => {
      const value = valueFor(mapping.target ?? "", values[index]);
      if (mapping.target && mapping.confirmed) {
        (row as unknown as Record<string, unknown>)[mapping.target] = value;
      } else {
        row.extras![mapping.source] = values[index];
      }
    });
    return row;
  });
}

function toEnrichmentRows(rows: ValidatedInventoryRow[]): EnrichmentRow[] {
  return rows.map((row) => ({
    rowId: row.assetId,
    assetId: row.assetId,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateAccuracyM: row.coordinateAccuracyM,
    spatialLicenseId: row.spatialLicenseId,
    sourceArtifactId: row.sourceArtifactId,
    spatialRights: row.spatialRights,
    supplier: row.supplier,
    format: row.format,
    rateNgn: row.rate,
    orientation: row.orientation,
  }));
}

export function UploadDialog({
  onClose,
  onDraft,
}: {
  onClose(): void;
  onDraft(draft: UploadPlanningDraft, snapshot: EnrichmentSnapshot): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [accepted, setAccepted] = useState<ValidatedInventoryRow[]>([]);
  const [sheets, setSheets] = useState<LocalSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerMappings, setHeaderMappings] = useState<HeaderMapping[]>([]);
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [selected, setSelected] = useState(new Set<string>());
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EnrichmentSnapshot | null>(null);
  const [corrections, setCorrections] = useState<Record<
    string,
    { latitude: string; longitude: string }
  >>({});

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  const uploadScenes = useMemo(() => {
    const selectedRows = snapshot?.rows.filter(
      (item) => selected.has(item.row.rowId),
    ) ?? [];
    const localFeatures: SpatialFeature[] = selectedRows.flatMap((item) => {
      const coordinateField = item.customerCorrection ?? item.uploadedCoordinate;
      if (!coordinateField) return [];
      return [{
        id: item.row.rowId,
        coordinateField,
        visual: {
          label: item.row.address ?? item.row.rowId,
          metricLabel: "Uploaded location context",
          value: null,
          unit: "none" as const,
          evidenceLabel: item.customerCorrection
            ? "Customer-corrected coordinate"
            : "Uploaded coordinate · " +
              (item.row.coordinateAccuracyM
                ? "±" + item.row.coordinateAccuracyM + " m"
                : "accuracy undeclared"),
        },
      }];
    });
    const providerFeatures: SpatialFeature[] = selectedRows.flatMap((item) => {
      const candidate = item.candidates.find(
        (value) => value.candidateToken === item.selectedCandidateToken,
      ) ?? item.candidates[0];
      if (!candidate) return [];
      return [{
        id: "provider/" + item.row.rowId,
        coordinateField: candidate.coordinate,
        visual: {
          label: item.row.address ?? item.row.rowId,
          metricLabel: "Geocode review",
          value: null,
          unit: "none" as const,
          evidenceLabel: candidate.granularity.value,
        },
      }];
    });
    return {
      local: projectMapLibreScene(localFeatures),
      provider: projectGoogleScene(providerFeatures),
    };
  }, [snapshot, selected]);

  function applyMappedSheet(sheet: LocalSheet, mappings: HeaderMapping[]) {
    const validated = validateMappedRows(mapSheet(sheet, mappings));
    setAccepted(validated.accepted);
    setQuarantineCount(validated.quarantined.length);
    setRejectedCount(validated.rejected.length);
    setSelected(new Set(validated.accepted.slice(0, 50).map((row) => row.assetId)));
    setPreflight(null);
    setEnrichmentError(null);
    setSnapshot(createLocalEnrichmentSnapshot(
      toEnrichmentRows(validated.accepted.slice(0, 50)),
      new Date().toISOString(),
    ));
  }

  function inspectSheet(sheet: LocalSheet) {
    const mappings = headerMappingsFor(sheet);
    setHeaderMappings(mappings);
    setPreflight(null);
    setEnrichmentError(null);
    const ambiguous = mappings.some((mapping) => mapping.target && !mapping.confirmed);
    if (ambiguous) {
      setAccepted([]);
      setQuarantineCount(0);
      setRejectedCount(0);
      setSelected(new Set());
      setSnapshot(null);
      return;
    }
    applyMappedSheet(sheet, mappings);
  }

  function confirmMappings() {
    const sheet = sheets[sheetIndex];
    if (!sheet) return;
    const confirmed = headerMappings.map((mapping) =>
      mapping.target ? { ...mapping, confirmed: true } : mapping,
    );
    setHeaderMappings(confirmed);
    applyMappedSheet(sheet, confirmed);
  }

  async function selectFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const workbook = await readLocalSpreadsheet(file);
      setSheets(workbook.sheets);
      setSheetIndex(0);
      inspectSheet(workbook.sheets[0]);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "SPREADSHEET_PARSE_FAILED");
      setAccepted([]);
      setSelected(new Set());
      setHeaderMappings([]);
    } finally {
      setParsing(false);
    }
  }

  function selectedEnrichmentRows(): EnrichmentRow[] {
    return toEnrichmentRows(selectRowsForEnrichment(accepted, [...selected]));
  }

  async function reviewEnrichment() {
    try {
      setEnrichmentError(null);
      const rows = selectedEnrichmentRows();
      if (rows.length === 0) throw new Error("SELECT_AT_LEAST_ONE_ROW");
      setPreflight(await requestPreflight({ rows }));
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "PREFLIGHT_FAILED");
    }
  }

  async function enrichLocations() {
    try {
      setEnrichmentError(null);
      if (!preflight || typeof preflight.id !== "string") throw new Error("PREFLIGHT_REQUIRED");
      const rows = selectedEnrichmentRows();
      const responses = await runEnrichment({
        preflightId: preflight.id,
        rows,
        authorized: true,
        idempotencyKey: crypto.randomUUID(),
      }) as GeocodeResponse[];
      const local = createLocalEnrichmentSnapshot(rows, new Date().toISOString());
      setSnapshot(mergeProviderResponses(local, responses, new Date().toISOString()));
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "ENRICHMENT_FAILED");
    }
  }

  function useUploadedFacts() {
    const local = createLocalEnrichmentSnapshot(
      selectedEnrichmentRows(),
      new Date().toISOString(),
    );
    onDraft(applyUploadToDraft(local, [...selected]), local);
  }

  function updateCorrection(
    rowId: string,
    field: "latitude" | "longitude",
    value: string,
  ) {
    setCorrections((current) => ({
      ...current,
      [rowId]: {
        latitude: current[rowId]?.latitude ?? "",
        longitude: current[rowId]?.longitude ?? "",
        [field]: value,
      },
    }));
  }

  function applyCorrection(rowId: string) {
    const value = corrections[rowId];
    if (!value?.latitude.trim() || !value.longitude.trim()) {
      setEnrichmentError("CORRECTION_COORDINATE_REQUIRED");
      return;
    }
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      setEnrichmentError("CORRECTION_COORDINATE_INVALID");
      return;
    }
    setEnrichmentError(null);
    setSnapshot((current) => current
      ? correctCoordinate(
          current,
          rowId,
          { latitude, longitude },
          "customer-upload-" + rowId,
        )
      : current,
    );
  }

  const pendingMappingReview = headerMappings.some(
    (mapping) => mapping.target && !mapping.confirmed,
  );

  return (
    <aside className="upload-dialog" role="dialog" aria-modal="true" aria-label="Upload inventory">
      <header className="upload-dialog-header">
        <button ref={closeRef} type="button" onClick={onClose}>Close</button>
        <div>
          <span>Customer inventory · context only</span>
          <h1>Upload inventory</h1>
          <p>Bring customer-owned or supplier inventory into the planning workspace without upgrading its delivery evidence.</p>
        </div>
      </header>

      <section className="upload-step" aria-labelledby="upload-file-heading">
        <header><span>1</span><div><h2 id="upload-file-heading">Upload file</h2><p>CSV, TSV or XLSX is read locally before any optional provider request.</p></div></header>
        <input aria-label="Inventory spreadsheet" type="file" accept=".csv,.tsv,.xlsx" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void selectFile(file);
          event.target.value = "";
        }} />
        {sheets.length > 1 && <label>Worksheet<select value={sheetIndex} onChange={(event) => {
          const index = Number(event.target.value);
          setSheetIndex(index);
          inspectSheet(sheets[index]);
        }}>{sheets.map((sheet, index) => (
          <option key={sheet.name} value={index}>{sheet.name}</option>
        ))}</select></label>}
      </section>

      {pendingMappingReview && <section className="upload-step" aria-label="Review column mappings">
        <header><span>2</span><div><h2>Map columns</h2><p>Some headings were recognized approximately. Confirm what each column means before rows are used.</p></div></header>
        {headerMappings.map((mapping, index) => mapping.target && !mapping.confirmed ? (
          <label key={mapping.source}>
            Spreadsheet column · {mapping.source}
            <select
              aria-label={"Map " + mapping.source}
              value={mapping.target ?? ""}
              onChange={(event) => setHeaderMappings((current) => current.map(
                (item, itemIndex) => itemIndex === index
                  ? {
                      ...item,
                      target: (event.target.value || null) as CanonicalHeader | null,
                      confirmed: false,
                    }
                  : item,
              ))}
            >
              <option value="">Ignore column</option>
              {mappingOptions.map((option) => (
                <option key={option} value={option}>{mappingLabels[option]}</option>
              ))}
            </select>
          </label>
        ) : null)}
        <button type="button" onClick={confirmMappings}>Confirm mappings</button>
      </section>}

      <section className="upload-step" aria-labelledby="upload-review-heading">
        <header><span>3</span><div><h2 id="upload-review-heading">Review rows</h2><p>Accepted rows can be selected now; rows needing attention remain counted for follow-up.</p></div></header>
        <p className="upload-row-status">{parsing
          ? "Reading spreadsheet locally…"
          : accepted.length + " accepted · " + quarantineCount + " need attention · " + rejectedCount + " rejected"}</p>
        {parseError && <div role="alert" className="upload-error">
          <p>We could not read this spreadsheet.</p>
          <details><summary>Technical code</summary><code>{parseError}</code></details>
        </div>}
        {enrichmentError && <div role="alert" className="upload-error">
          <p>{uploadErrorMessage(enrichmentError)}</p>
          <details><summary>Technical code</summary><code>{enrichmentError}</code></details>
        </div>}
        {!pendingMappingReview && <UploadPreview
          rows={accepted}
          selected={selected}
          onToggle={(assetId) => setSelected((current) => {
            const next = new Set(current);
            if (next.has(assetId)) {
              next.delete(assetId);
            } else {
              next.add(assetId);
            }
            if (next.size > 50) return current;
            return next;
          })}
        />}
      </section>

      <section className="upload-step" aria-labelledby="upload-use-heading">
        <header><span>4</span><div><h2 id="upload-use-heading">Use as context</h2><p>Choose the offline path immediately, or review an optional live geocoding request first. Provider results remain context-only.</p></div></header>
        <div className="upload-path-choices">
          <button
            type="button"
            disabled={parsing || pendingMappingReview || selected.size === 0}
            onClick={useUploadedFacts}
          >
            <strong>Use uploaded facts as context</strong>
            <span>Offline · no provider call</span>
          </button>
          <button
            type="button"
            disabled={parsing || pendingMappingReview || selected.size === 0}
            onClick={() => void reviewEnrichment()}
          >
            <strong>Review enrichment</strong>
            <span>Optional live provider lookup · authorization required</span>
          </button>
        </div>
      </section>

      {preflight && <section className="upload-step upload-preflight" aria-label="Enrichment preflight">
        <header><span>5</span><div><h2>Confirm live enrichment</h2><p>The provider request has been prepared but has not yet been run from this action.</p></div></header>
        <dl>
          <div><dt>Selected rows</dt><dd>{selected.size}</dd></div>
          <div><dt>Decision use</dt><dd>Context only</dd></div>
          <div><dt>Provider action</dt><dd>Geocode review</dd></div>
        </dl>
        <button type="button" onClick={() => void enrichLocations()}>
          Enrich locations
        </button>
        <details>
          <summary>Technical preflight details</summary>
          <pre>{JSON.stringify(preflight, null, 2)}</pre>
        </details>
      </section>}

      {snapshot && <section className="upload-step upload-location-review" aria-label="Geocode review">
        <header><span>{preflight ? "6" : "5"}</span><div><h2>Review locations</h2><p>Customer/open coordinates work offline. Provider candidates remain optional, context-only, and separately reviewable.</p></div></header>
        {uploadScenes.local.features.length > 0 && <div className="upload-map">
          <h3>Uploaded coordinates · offline preview</h3>
          <MapCanvas scene={uploadScenes.local} />
        </div>}
        {uploadScenes.provider.features.length > 0 && <div className="upload-map">
          <h3>Provider candidates · review only</h3>
          <MapCanvas
            scene={uploadScenes.provider}
            onFeatureSelect={(featureId) => setSnapshot((current) => {
              const rowId = featureId.replace(/^provider\//, "");
              const item = current?.rows.find((value) => value.row.rowId === rowId);
              const candidate = item?.candidates[0];
              return current && candidate
                ? confirmGeocodeIdentity(current, rowId, candidate.candidateToken)
                : current;
            })}
          />
        </div>}
        {snapshot.rows.filter((item) => selected.has(item.row.rowId)).map((item) => (
          <article className="upload-location-card" key={item.row.rowId}>
            <header>
              <h3>{item.row.address ?? item.row.rowId}</h3>
              <p>
                {[item.row.supplier, item.row.format, item.row.orientation]
                  .filter(Boolean).join(" · ")}
                {item.row.rateNgn === undefined ? "" : " · ₦" + item.row.rateNgn.toLocaleString("en")}
              </p>
            </header>
            {item.candidates.length === 0 && <p>No provider candidate returned.</p>}
            {item.candidates.map((candidate) => (
              <button
                key={candidate.candidateToken}
                type="button"
                aria-pressed={item.selectedCandidateToken === candidate.candidateToken}
                onClick={() => setSnapshot((current) => current
                  ? confirmGeocodeIdentity(current, item.row.rowId, candidate.candidateToken)
                  : current,
                )}
              >
                Confirm {candidate.formattedAddress.value} · {candidate.granularity.value}
              </button>
            ))}
            <details>
              <summary>Correct coordinates manually</summary>
              <div className="upload-coordinate-correction">
                <label>
                  Correct latitude
                  <input
                    inputMode="decimal"
                    value={corrections[item.row.rowId]?.latitude ?? ""}
                    onChange={(event) => updateCorrection(item.row.rowId, "latitude", event.target.value)}
                  />
                </label>
                <label>
                  Correct longitude
                  <input
                    inputMode="decimal"
                    value={corrections[item.row.rowId]?.longitude ?? ""}
                    onChange={(event) => updateCorrection(item.row.rowId, "longitude", event.target.value)}
                  />
                </label>
                <button type="button" onClick={() => applyCorrection(item.row.rowId)}>
                  Use customer coordinate
                </button>
              </div>
            </details>
          </article>
        ))}
        <button type="button" className="primary" onClick={() => onDraft(
          applyUploadToDraft(snapshot, [...selected]),
          snapshot,
        )}>
          Use reviewed facts as context
        </button>
      </section>}
    </aside>
  );
}
