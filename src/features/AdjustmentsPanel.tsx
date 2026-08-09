import { useState } from "react";
import type { selectPlanDeltas } from "@/application/plannerSelectors";
import type { AdjustmentOptions, AdjustmentSiteOption } from "@/application/plannerService";

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
        <p role="status">Delivery is not subtracted because the comparison basis changed.</p>
      )}
      <dl className="adjustment-impact-grid">
        <div><dt>Spend</dt><dd>{signedCurrency(delta.costNgn)}</dd></div>
        <div><dt>Planning Fit</dt><dd>{signed(delta.planningFit)}</dd></div>
        <div><dt>Evidence</dt><dd>{signed(delta.evidenceScore)}</dd></div>
        <div>
          <dt>{delta.comparable ? delta.deliveryLabel : "Objective delivery"}</dt>
          <dd>{delta.eligibleDelivery === null
            ? "Not comparable"
            : `${signed(delta.eligibleDelivery)} ${delta.deliveryUnit}`}</dd>
        </div>
      </dl>
      <details>
        <summary>Audit / calculation details</summary>
        <div className="comparison-pair">
          <AuditPlan label="Applied" summary={delta.from} />
          <AuditPlan label="Proposed" summary={delta.to} />
        </div>
        <dl>
          <div><dt>Reason code</dt><dd>{delta.reasonCode ?? "Comparable"}</dd></div>
          <div><dt>Changed zones</dt><dd>{delta.changedZoneIds.join(", ") || "None"}</dd></div>
          <div><dt>Changed sites</dt><dd>{delta.changedSiteIds.join(", ") || "None"}</dd></div>
          <div><dt>Affected pillars</dt><dd>{delta.affectedPillars.join(", ") || "None"}</dd></div>
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
    <section aria-label={`${label} audit basis`}>
      <h4>{label}</h4>
      <dl>
        <div><dt>Cost</dt><dd>NGN {number(summary.costNgn)}</dd></div>
        <div><dt>Planning Fit</dt><dd>{number(summary.planningFit)}</dd></div>
        <div><dt>Evidence</dt><dd>{number(summary.evidenceScore)} · {summary.evidenceGrade}</dd></div>
        <div><dt>{summary.deliveryLabel} · Low / Base / High</dt><dd>{rangeText(summary.deliveryRange)} {summary.deliveryUnit}</dd></div>
        <div><dt>Selected zones</dt><dd>{summary.zoneIds.join(", ") || "None"}</dd></div>
        <div><dt>Selected sites</dt><dd>{summary.siteIds.join(", ") || "None"}</dd></div>
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
    <aside aria-label="Plan adjustments">
      <header className="adjustment-header">
        <div>
          <span>{isDirty ? "Unapplied changes" : "Fine-tune package"}</span>
          <strong>Choose exactly what you want to change</strong>
        </div>
        <div className="adjustment-history-actions">
          <button type="button" disabled={!isDirty} onClick={onUndo}>Undo last change</button>
          <button type="button" onClick={onReset}>Reset to original</button>
        </div>
      </header>

      {invalidReasons.length > 0 && (
        <section role="alert" aria-label="Fine-tune constraints">
          <strong>Package needs repair before it can be applied</strong>
          {invalidReasons.map((reason) => <p key={reason}>{reason}</p>)}
        </section>
      )}

      {isDirty && deltas && <DecisionSummary delta={deltas.currentToDraft} />}

      <div className="adjustment-actions-grid">
        <section>
          <h3>Add a compatible face</h3>
          <p>Add one eligible face inside a zone already in the package.</p>
          <select aria-label="Face to add" value={addSiteId} onChange={(event) => setAddSiteId(event.target.value)}>
            <option value="">Choose a face</option>
            {options.addableSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!addSiteId} onClick={() => {
            onAdd(addSiteId);
            setAddSiteId("");
          }}>Add selected face</button>
        </section>

        <section>
          <h3>Swap a face</h3>
          <p>Choose the current face, then a compatible replacement in the same zone.</p>
          <select aria-label="Current face to swap" value={swapSiteId} onChange={(event) => {
            setSwapSiteId(event.target.value);
            setSwapReplacementId("");
          }}>
            <option value="">Choose current face</option>
            {options.selectedSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <select aria-label="Replacement face" value={swapReplacementId} disabled={!swapSiteId} onChange={(event) => setSwapReplacementId(event.target.value)}>
            <option value="">Choose replacement</option>
            {swapOptions.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!swapSiteId || !swapReplacementId} onClick={() => {
            onSwap(swapSiteId, swapReplacementId);
            setSwapSiteId("");
            setSwapReplacementId("");
          }}>Swap selected face</button>
        </section>

        <section>
          <h3>Replace a zone</h3>
          <p>Choose the zone to remove and the eligible outside zone you want to test.</p>
          <select aria-label="Current zone to replace" value={replaceZoneId} onChange={(event) => setReplaceZoneId(event.target.value)}>
            <option value="">Choose current zone</option>
            {options.selectedZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </select>
          <select aria-label="Replacement zone" value={replacementZoneId} onChange={(event) => setReplacementZoneId(event.target.value)}>
            <option value="">Choose replacement zone</option>
            {options.alternativeZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </select>
          <button type="button" disabled={!replaceZoneId || !replacementZoneId} onClick={() => {
            onReplaceZone(replaceZoneId, replacementZoneId);
            setReplaceZoneId("");
            setReplacementZoneId("");
          }}>Replace selected zone</button>
        </section>

        <section>
          <h3>Remove a face</h3>
          <p>Remove a specific selected face and inspect the resulting delivery trade-off.</p>
          <select aria-label="Face to remove" value={removeSiteId} onChange={(event) => setRemoveSiteId(event.target.value)}>
            <option value="">Choose a face</option>
            {options.selectedSites.map((site) => <option key={site.id} value={site.id}>{siteText(site)}</option>)}
          </select>
          <button type="button" disabled={!removeSiteId} onClick={() => {
            onRemove(removeSiteId);
            setRemoveSiteId("");
          }}>Remove selected face</button>
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
