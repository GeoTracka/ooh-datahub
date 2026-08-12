import { useState } from "react";
import type { selectPlanDeltas } from "@/application/plannerSelectors";
import type { AdjustmentOptions, AdjustmentSiteOption } from "@/application/plannerService";
import { PackageConstraintNotice } from "@/features/PackageConstraintNotice";
import { PUBLIC_COPY, confidenceLabel } from "@/content/plainLanguage";

type PlanDeltas = NonNullable<ReturnType<typeof selectPlanDeltas>>;
type PlanDelta = PlanDeltas["currentToDraft"];

function number(value: number | null): string {
  return value === null ? "Unavailable" : Math.round(value).toLocaleString("en");
}

function signed(value: number | null): string {
  if (value === null) return "Unavailable";
  return (value > 0 ? "+" : "") + Number(value.toFixed(1)).toLocaleString("en");
}

function signedCurrency(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}₦${Math.abs(Math.round(value)).toLocaleString("en")}`;
}

function rangeText(range: PlanDelta["from"]["deliveryRange"]): string {
  return range
    ? [range.low, range.base, range.high].map(number).join(" / ")
    : "Unavailable";
}

function siteText(site: AdjustmentSiteOption): string {
  return `${site.label} · ${site.zoneLabel} · ₦${site.rateNgn.toLocaleString("en")}`;
}

function DecisionSummary({ delta }: { delta: PlanDelta }) {
  return (
    <section className="adjustment-summary" aria-label="Proposed package change summary">
      <header>
        <span>Proposed change</span>
        <strong>{delta.action}</strong>
        <p>{delta.tradeOff}</p>
      </header>
      {!delta.comparable && (
        <p role="status">Audience delivery is shown side by side because the campaign settings changed.</p>
      )}
      <dl className="adjustment-impact-grid">
        <div><dt>Spend</dt><dd>{signedCurrency(delta.costNgn)}</dd></div>
        <div><dt>{PUBLIC_COPY.metrics.planScore}</dt><dd>{signed(delta.planningFit)}</dd></div>
        <div><dt>Data confidence</dt><dd>{signed(delta.evidenceScore)}</dd></div>
        <div>
          <dt>{delta.comparable ? delta.deliveryLabel : "Audience delivery"}</dt>
          <dd>{delta.eligibleDelivery === null
            ? "Not comparable"
            : `${signed(delta.eligibleDelivery)} ${delta.deliveryUnit}`}</dd>
        </div>
      </dl>
      <details>
        <summary>Technical calculation details</summary>
        <div className="comparison-pair">
          <AuditPlan label={PUBLIC_COPY.fineTune.current} summary={delta.from} />
          <AuditPlan label={PUBLIC_COPY.fineTune.proposed} summary={delta.to} />
        </div>
        <dl>
            <div><dt>Why the comparison changed</dt><dd>{delta.reasonCode ?? "The packages can be compared directly"}</dd></div>
          <div><dt>{PUBLIC_COPY.fineTune.changedAreas}</dt><dd>{delta.changedZoneIds.join(", ") || "None"}</dd></div>
          <div><dt>{PUBLIC_COPY.fineTune.changedLocations}</dt><dd>{delta.changedSiteIds.join(", ") || "None"}</dd></div>
          <div><dt>{PUBLIC_COPY.fineTune.scoreAreas}</dt><dd>{delta.affectedPillars.join(", ") || "None"}</dd></div>
        </dl>
      </details>
    </section>
  );
}

function AuditPlan({
  label,
  summary,
}: {
  label: string;
  summary: PlanDelta["from"];
}) {
  return (
    <section aria-label={`${label} comparison details`}>
      <h2>{label}</h2>
      <dl>
        <div><dt>Cost</dt><dd>NGN {number(summary.costNgn)}</dd></div>
        <div><dt>{PUBLIC_COPY.metrics.planScore}</dt><dd>{number(summary.planningFit)}</dd></div>
        <div><dt>Data confidence</dt><dd>{number(summary.evidenceScore)} · {confidenceLabel(summary.evidenceGrade)}</dd></div>
        <div><dt>{summary.deliveryLabel} · Lower / Expected / Upper</dt><dd>{rangeText(summary.deliveryRange)} {summary.deliveryUnit}</dd></div>
        <div><dt>Selected areas</dt><dd>{summary.zoneIds.join(", ") || "None"}</dd></div>
        <div><dt>Selected media locations</dt><dd>{summary.siteIds.join(", ") || "None"}</dd></div>
        <div><dt>Data revision</dt><dd>{summary.dataRevision}</dd></div>
        <div><dt>Fingerprint</dt><dd><code>{summary.fingerprint}</code></dd></div>
        <div><dt>Comparability</dt><dd><code>{summary.comparabilityKey}</code></dd></div>
      </dl>
    </section>
  );
}

export function AdjustmentsPanel({
  isDirty,
  options,
  deltas,
  invalidReasons,
  onAdd,
  onRemove,
  onSwap,
  onReplaceZone,
  onUndo,
  onReset,
}: {
  isDirty: boolean;
  options: AdjustmentOptions;
  deltas: ReturnType<typeof selectPlanDeltas>;
  invalidReasons: string[];
  onAdd(siteId: string): void;
  onRemove(siteId: string): void;
  onSwap(siteId: string, replacementSiteId: string): void;
  onReplaceZone(zoneId: string, replacementZoneId: string): void;
  onUndo(): void;
  onReset(): void;
}) {
  const [addSiteId, setAddSiteId] = useState("");
  const [swapSiteId, setSwapSiteId] = useState("");
  const [swapReplacementId, setSwapReplacementId] = useState("");
  const [replaceZoneId, setReplaceZoneId] = useState("");
  const [replacementZoneId, setReplacementZoneId] = useState("");
  const [removeSiteId, setRemoveSiteId] = useState("");
  const swapOptions = swapSiteId
    ? options.replacementSitesBySelectedSite[swapSiteId] ?? []
    : [];

  return (
    <aside aria-label="Package adjustments">
      <header className="adjustment-header">
        <div>
          <span>{isDirty ? "Changes not yet applied" : PUBLIC_COPY.fineTune.title}</span>
          <strong>Choose exactly what you want to change</strong>
        </div>
        <div className="adjustment-history-actions">
          <button type="button" disabled={!isDirty} onClick={onUndo}>Undo last change</button>
          <button type="button" onClick={onReset}>Reset to original</button>
        </div>
      </header>

      {invalidReasons.length > 0 && (
        <PackageConstraintNotice reasonCodes={invalidReasons} />
      )}

      {isDirty && deltas && <DecisionSummary delta={deltas.currentToDraft} />}

      <div className="adjustment-actions-grid">
        <section>
          <h2>Add a media location</h2>
          <p>Add an available media location within an area already in the package.</p>
          <select aria-label="Media location to add" value={addSiteId} onChange={(event) => setAddSiteId(event.target.value)}>
            <option value="">Choose a media location</option>
            {options.addableSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!addSiteId} onClick={() => {
            onAdd(addSiteId);
            setAddSiteId("");
          }}>Add selected location</button>
        </section>

        <section>
          <h2>Swap a media location</h2>
          <p>Choose the current location, then an available replacement in the same area.</p>
          <select aria-label="Current media location to swap" value={swapSiteId} onChange={(event) => {
            setSwapSiteId(event.target.value);
            setSwapReplacementId("");
          }}>
            <option value="">Choose current location</option>
            {options.selectedSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <select aria-label="Replacement media location" value={swapReplacementId} disabled={!swapSiteId} onChange={(event) => setSwapReplacementId(event.target.value)}>
            <option value="">Choose replacement</option>
            {swapOptions.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!swapSiteId || !swapReplacementId} onClick={() => {
            onSwap(swapSiteId, swapReplacementId);
            setSwapSiteId("");
            setSwapReplacementId("");
          }}>Swap selected location</button>
        </section>

        <section>
          <h2>Replace an area</h2>
          <p>Choose the area to remove and an available area you want to test.</p>
          <select aria-label="Current area to replace" value={replaceZoneId} onChange={(event) => setReplaceZoneId(event.target.value)}>
            <option value="">Choose current area</option>
            {options.selectedZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </select>
          <select aria-label="Replacement area" value={replacementZoneId} onChange={(event) => setReplacementZoneId(event.target.value)}>
            <option value="">Choose replacement area</option>
            {options.alternativeZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </select>
          <button type="button" disabled={!replaceZoneId || !replacementZoneId} onClick={() => {
            onReplaceZone(replaceZoneId, replacementZoneId);
            setReplaceZoneId("");
            setReplacementZoneId("");
          }}>Replace selected area</button>
        </section>

        <section>
          <h2>Remove a media location</h2>
          <p>Remove one location and review how the audience estimate and cost change.</p>
          <select aria-label="Media location to remove" value={removeSiteId} onChange={(event) => setRemoveSiteId(event.target.value)}>
            <option value="">Choose a media location</option>
            {options.selectedSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!removeSiteId} onClick={() => {
            onRemove(removeSiteId);
            setRemoveSiteId("");
          }}>Remove selected location</button>
        </section>
      </div>

      {isDirty && deltas && (
        <details>
          <summary>Compare proposed package with original recommendation</summary>
          <DecisionSummary delta={deltas.originalToDraft} />
        </details>
      )}
    </aside>
  );
}
