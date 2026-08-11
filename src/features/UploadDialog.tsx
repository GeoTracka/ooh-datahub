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
import { PlannerDrawerFrame } from "@/features/PlannerDrawerFrame";
import { OperationStatus } from "@/features/OperationStatus";
import { RecoveryNotice } from "@/features/RecoveryNotice";
import { summarizeReasonCodes, uploadErrorCopy } from "@/features/recoveryCopy";
import { UploadPreview } from "@/features/UploadPreview";
import { MapCanvas } from "@/maps/MapCanvas";
import {
  projectGoogleScene,
  projectMapLibreScene,
} from "@/maps/projectScene";

type HeaderMapping = ReturnType<typeof mapHeaders>[number];

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const parsingRef = useRef(false);
  const providerBusyRef = useRef(false);
  const providerAbortRef = useRef<AbortController | null>(null);
  const [accepted, setAccepted] = useState<ValidatedInventoryRow[]>([]);
  const [sheets, setSheets] = useState<LocalSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerMappings, setHeaderMappings] = useState<HeaderMapping[]>([]);
  const [quarantined, setQuarantined] = useState<Array<{ reasonCodes: string[] }>>([]);
  const [rejected, setRejected] = useState<Array<{ reasonCodes: string[] }>>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [parsing, setParsing] = useState(false);
  const [enrichmentBusy, setEnrichmentBusy] = useState<"preflight" | "enriching" | null>(null);
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
  useEffect(() => () => {
    providerAbortRef.current?.abort();
  }, []);
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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
    setQuarantined(validated.quarantined.map(({ reasonCodes }) => ({ reasonCodes })));
    setRejected(validated.rejected.map(({ reasonCodes }) => ({ reasonCodes })));
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
      setQuarantined([]);
      setRejected([]);
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
    if (parsingRef.current || providerBusyRef.current) return;
    parsingRef.current = true;
    setParsing(true);
    setParseError(null);
    setAccepted([]);
    setSelected(new Set());
    setQuarantined([]);
    setRejected([]);
    setSnapshot(null);
    setPreflight(null);
    setEnrichmentError(null);
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
      setQuarantined([]);
      setRejected([]);
      setSnapshot(null);
      setPreflight(null);
    } finally {
      parsingRef.current = false;
      setParsing(false);
    }
  }

  function selectedEnrichmentRows(): EnrichmentRow[] {
    return toEnrichmentRows(selectRowsForEnrichment(accepted, [...selected]));
  }

  async function reviewEnrichment() {
    if (providerBusyRef.current || parsingRef.current) return;
    providerBusyRef.current = true;
    setEnrichmentBusy("preflight");
    setEnrichmentError(null);
    const controller = new AbortController();
    providerAbortRef.current = controller;
    try {
      const rows = selectedEnrichmentRows();
      if (rows.length === 0) throw new Error("SELECT_AT_LEAST_ONE_ROW");
      const nextPreflight = await requestPreflight({ rows }, controller.signal);
      if (!controller.signal.aborted) setPreflight(nextPreflight);
    } catch (error) {
      if (!controller.signal.aborted) {
        setEnrichmentError(error instanceof Error ? error.message : "PREFLIGHT_FAILED");
      }
    } finally {
      if (providerAbortRef.current === controller) providerAbortRef.current = null;
      providerBusyRef.current = false;
      setEnrichmentBusy(null);
    }
  }

  async function enrichLocations() {
    if (providerBusyRef.current || parsingRef.current) return;
    providerBusyRef.current = true;
    setEnrichmentBusy("enriching");
    setEnrichmentError(null);
    const controller = new AbortController();
    providerAbortRef.current = controller;
    try {
      if (!preflight || typeof preflight.id !== "string") throw new Error("PREFLIGHT_REQUIRED");
      const rows = selectedEnrichmentRows();
      const responses = await runEnrichment({
        preflightId: preflight.id,
        rows,
        authorized: true,
        idempotencyKey: crypto.randomUUID(),
      }, controller.signal) as GeocodeResponse[];
      if (controller.signal.aborted) return;
      const local = createLocalEnrichmentSnapshot(rows, new Date().toISOString());
      setSnapshot(mergeProviderResponses(local, responses, new Date().toISOString()));
    } catch (error) {
      if (!controller.signal.aborted) {
        setEnrichmentError(error instanceof Error ? error.message : "ENRICHMENT_FAILED");
      }
    } finally {
      if (providerAbortRef.current === controller) providerAbortRef.current = null;
      providerBusyRef.current = false;
      setEnrichmentBusy(null);
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
  const busy = parsing || enrichmentBusy !== null;
  const parseRecovery = parseError ? uploadErrorCopy("parse", parseError) : null;
  const enrichmentRecovery = enrichmentError
    ? uploadErrorCopy("provider", enrichmentError)
    : null;
  const quarantineSummary = summarizeReasonCodes(quarantined);
  const rejectionSummary = summarizeReasonCodes(rejected);
  const validationCodes = [...new Set([
    ...quarantineSummary.map((item) => item.code),
    ...rejectionSummary.map((item) => item.code),
  ])];

  return (
    <PlannerDrawerFrame
      ariaLabel="Upload inventory"
      eyebrow="Customer inventory"
      className="upload-drawer"
      dialogRef={dialogRef}
      closeRef={closeRef}
      onClose={onClose}
      busy={busy}
    >
      <section className="upload-intake" aria-label="Upload source">
        <input aria-label="Inventory spreadsheet" type="file" accept=".csv,.tsv,.xlsx" disabled={busy} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void selectFile(file);
          event.target.value = "";
        }} />
        {sheets.length > 1 && <label>Worksheet<select disabled={busy} value={sheetIndex} onChange={(event) => {
          const index = Number(event.target.value);
          setSheetIndex(index);
          inspectSheet(sheets[index]);
        }}>{sheets.map((sheet, index) => (
          <option key={sheet.name} value={index}>{sheet.name}</option>
        ))}</select></label>}
      </section>
      {pendingMappingReview && <section className="planner-drawer-notice" aria-label="Review column mappings">
        <h2>Confirm spreadsheet columns</h2>
        <strong>Review required before rows can be used</strong>
        <p>Some columns were recognized approximately. Confirm or correct them before the rows are used; approximate matches are never applied automatically.</p>
        {headerMappings.map((mapping, index) => mapping.target && !mapping.confirmed ? (
          <label key={mapping.source}>
            {mapping.source}
            <select
              aria-label={"Map " + mapping.source}
              value={mapping.target ?? ""}
              disabled={busy}
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
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null)}
        <button type="button" disabled={busy} onClick={confirmMappings}>Confirm mappings</button>
      </section>}
      {parsing ? (
        <OperationStatus
          title="Reading spreadsheet locally…"
          detail="Checking columns and row validity on this device. No provider request is running."
        />
      ) : (
        <p className="upload-status-line">{accepted.length + " accepted · " + quarantined.length + " quarantined · " + rejected.length + " rejected"}</p>
      )}
      {enrichmentBusy === "preflight" && (
        <OperationStatus
          title="Checking enrichment requirements…"
          detail="Reviewing the selected rows and provider preflight. No location enrichment has started yet."
        />
      )}
      {enrichmentBusy === "enriching" && (
        <OperationStatus
          title="Reviewing provider location candidates…"
          detail="The selected rows are locked until this enrichment attempt finishes or the drawer is closed."
        />
      )}
      {parseRecovery && (
        <RecoveryNotice
          ariaLabel="Spreadsheet read failure"
          title={parseRecovery.title}
          tone="error"
          technicalCode={parseError}
        >
          <p>{parseRecovery.message}</p>
        </RecoveryNotice>
      )}
      {enrichmentRecovery && (
        <RecoveryNotice
          ariaLabel="Enrichment failure"
          title={enrichmentRecovery.title}
          tone="warning"
          technicalCode={enrichmentError}
        >
          <p>{enrichmentRecovery.message}</p>
        </RecoveryNotice>
      )}
      {(quarantined.length > 0 || rejected.length > 0) && (
        <section className="upload-validation-summary" aria-label="Upload validation summary">
          <RecoveryNotice
            title="Some rows were kept out of planning"
            technicalCode={validationCodes.join(", ")}
          >
            <p>Only accepted rows can be selected for planning or enrichment. Quarantined and rejected rows remain excluded.</p>
            <ul>
              {quarantineSummary.map((item) => (
                <li key={`q-${item.code}`}><strong>{item.count} quarantined</strong> · {item.label}</li>
              ))}
              {rejectionSummary.map((item) => (
                <li key={`r-${item.code}`}><strong>{item.count} rejected</strong> · {item.label}</li>
              ))}
            </ul>
          </RecoveryNotice>
        </section>
      )}
      {!pendingMappingReview && accepted.length > 0 && <UploadPreview
        rows={accepted}
        selected={selected}
        disabled={busy}
        onToggle={(assetId) => {
          if (busy) return;
          setPreflight(null);
          setEnrichmentError(null);
          setSelected((current) => {
            const next = new Set(current);
            if (next.has(assetId)) {
              next.delete(assetId);
            } else {
              next.add(assetId);
            }
            if (next.size > 50) return current;
            return next;
          });
        }}
      />}
      <div className="planner-drawer-action-row upload-context-actions">
        <button
          type="button"
          disabled={busy || pendingMappingReview || selected.size === 0}
          onClick={useUploadedFacts}
        >
          Use uploaded facts as context
        </button>
        <button
          type="button"
          disabled={busy || pendingMappingReview || selected.size === 0}
          onClick={() => void reviewEnrichment()}
        >
          {enrichmentBusy === "preflight" ? "Checking enrichment…" : "Review enrichment"}
        </button>
      </div>
      {preflight && <section className="planner-drawer-output" aria-label="Enrichment preflight">
        <pre>{JSON.stringify(preflight, null, 2)}</pre>
        <button type="button" disabled={busy} onClick={() => void enrichLocations()}>
          {enrichmentBusy === "enriching" ? "Reviewing locations…" : "Enrich locations"}
        </button>
      </section>}
      {snapshot && <section className="upload-location-review" aria-label="Geocode review">
        <h2>Review locations</h2>
        <p>Customer/open coordinates work offline. Provider candidates remain optional, context-only, and separately reviewable.</p>
        {uploadScenes.local.features.length > 0 && <div className="upload-map">
          <h3>Uploaded coordinates · offline MapLibre preview</h3>
          <MapCanvas scene={uploadScenes.local} ariaLabel="Uploaded inventory map" />
        </div>}
        {uploadScenes.provider.features.length > 0 && <div className="upload-map">
          <h3>Provider candidates · Google review</h3>
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
            <h3>{item.row.address ?? item.row.rowId}</h3>
            <p>
              {[item.row.supplier, item.row.format, item.row.orientation]
                .filter(Boolean).join(" · ")}
              {item.row.rateNgn === undefined ? "" : " · ₦" + item.row.rateNgn.toLocaleString("en")}
            </p>
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
            <div className="planner-drawer-form-grid">
              <label>
                Correct latitude
                <input
                  inputMode="decimal"
                  value={corrections[item.row.rowId]?.latitude ?? ""}
                  onChange={(event) => updateCorrection(
                    item.row.rowId,
                    "latitude",
                    event.target.value,
                  )}
                />
              </label>
              <label>
                Correct longitude
                <input
                  inputMode="decimal"
                  value={corrections[item.row.rowId]?.longitude ?? ""}
                  onChange={(event) => updateCorrection(
                    item.row.rowId,
                    "longitude",
                    event.target.value,
                  )}
                />
              </label>
            </div>
            <button type="button" onClick={() => applyCorrection(item.row.rowId)}>
              Use customer coordinate
            </button>
          </article>
        ))}
        <div className="planner-drawer-primary-row">
          <button className="primary" type="button" onClick={() => onDraft(
            applyUploadToDraft(snapshot, [...selected]),
            snapshot,
          )}>
            Use reviewed facts as context
          </button>
        </div>
      </section>}
    </PlannerDrawerFrame>
  );
}
