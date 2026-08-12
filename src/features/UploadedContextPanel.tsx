import type { UploadedContextComparison } from "@/application/uploadContextSelectors";

function signedPercent(value: number): string {
  const rounded = Math.round(value);
  return (rounded > 0 ? "+" : "") + rounded + "%";
}

export function UploadedContextPanel({
  rows,
}: {
  rows: UploadedContextComparison[];
}) {
  if (rows.length === 0) return null;
  return (
    <details className="uploaded-context-panel">
      <summary>Uploaded inventory · {rows.length} row{rows.length === 1 ? "" : "s"}</summary>
      <p>
        These rows support map and package comparison only. They do not change audience estimates or the plan score.
      </p>
      <div className="uploaded-context-list">
        {rows.map((row) => (
          <article key={row.rowId}>
            <header>
              <strong>{row.assetId}</strong>
              <span>{row.supplier ?? "Supplier not supplied"}</span>
            </header>
            <dl>
              <div>
                <dt>Nearest selected area</dt>
                <dd>{row.nearestSelectedZone
                  ? `${row.nearestSelectedZone.label} · ${row.nearestSelectedZone.distanceKm.toFixed(1)} km`
                  : "Coordinate unavailable"}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{row.format ?? "Unknown"} · {row.formatFit === "matches_package"
                  ? "matches package formats"
                  : row.formatFit === "new_format"
                    ? "adds a new format"
                    : "fit unknown"}</dd>
              </div>
              <div>
                <dt>Supplied rate</dt>
                <dd>{row.rateNgn === null
                  ? "Not supplied"
                  : `₦${row.rateNgn.toLocaleString("en")}${row.rateDeltaPercent === null
                    ? ""
                    : ` · ${signedPercent(row.rateDeltaPercent)} vs the typical selected-location rate`}`}</dd>
              </div>
              <div>
                <dt>Information supplied</dt>
                <dd>{Math.round(row.metadataCompleteness * 100)}%</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </details>
  );
}
