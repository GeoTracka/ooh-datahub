import type { selectPlanDeltas } from "@/application/plannerSelectors";

type PlanDeltas = NonNullable<ReturnType<typeof selectPlanDeltas>>;
type PlanDelta = PlanDeltas["currentToDraft"];

function number(value: number | null): string {
  return value === null ? "Unavailable" : Math.round(value).toLocaleString("en");
}

function signed(value: number | null): string {
  if (value === null) return "Unavailable";
  return (value > 0 ? "+" : "") + Number(value.toFixed(1)).toLocaleString("en");
}

function rangeText(range: PlanDelta["from"]["deliveryRange"]): string {
  return range
    ? [range.low, range.base, range.high].map(number).join(" / ")
    : "Unavailable";
}

function Comparison({ label, delta }: { label: string; delta: PlanDelta }) {
  return <section aria-label={label + " comparison"}>
    <h3>{label}</h3>
    <p><strong>Action:</strong> {delta.action}</p>
    <p><strong>Trade-off:</strong> {delta.tradeOff}</p>
    {!delta.comparable && (
      <p role="status">Not comparable · {delta.reasonCode}</p>
    )}
    <div className="comparison-pair">
      <section aria-label={label + " previous"}>
        <h4>Previous</h4>
        <dl>
          <div><dt>Cost</dt><dd>NGN {number(delta.from.costNgn)}</dd></div>
          <div><dt>Planning Fit</dt><dd>{number(delta.from.planningFit)}</dd></div>
          <div><dt>Evidence</dt><dd>{number(delta.from.evidenceScore)} · {delta.from.evidenceGrade}</dd></div>
          <div><dt>{delta.from.deliveryLabel} · Low / Base / High</dt><dd>{rangeText(delta.from.deliveryRange)} {delta.from.deliveryUnit}</dd></div>
          <div><dt>Selected zones</dt><dd>{delta.from.zoneIds.join(", ") || "None"}</dd></div>
          <div><dt>Selected sites</dt><dd>{delta.from.siteIds.join(", ") || "None"}</dd></div>
          <div><dt>Data revision</dt><dd>{delta.from.dataRevision}</dd></div>
        </dl>
        <details>
          <summary>Calculation basis</summary>
          <p>Fingerprint <code>{delta.from.fingerprint}</code></p>
          <p>Comparability <code>{delta.from.comparabilityKey}</code></p>
        </details>
      </section>
      <section aria-label={label + " proposed"}>
        <h4>Proposed</h4>
        <dl>
          <div><dt>Cost</dt><dd>NGN {number(delta.to.costNgn)}</dd></div>
          <div><dt>Planning Fit</dt><dd>{number(delta.to.planningFit)}</dd></div>
          <div><dt>Evidence</dt><dd>{number(delta.to.evidenceScore)} · {delta.to.evidenceGrade}</dd></div>
          <div><dt>{delta.to.deliveryLabel} · Low / Base / High</dt><dd>{rangeText(delta.to.deliveryRange)} {delta.to.deliveryUnit}</dd></div>
          <div><dt>Selected zones</dt><dd>{delta.to.zoneIds.join(", ") || "None"}</dd></div>
          <div><dt>Selected sites</dt><dd>{delta.to.siteIds.join(", ") || "None"}</dd></div>
          <div><dt>Data revision</dt><dd>{delta.to.dataRevision}</dd></div>
        </dl>
        <details>
          <summary>Calculation basis</summary>
          <p>Fingerprint <code>{delta.to.fingerprint}</code></p>
          <p>Comparability <code>{delta.to.comparabilityKey}</code></p>
        </details>
      </section>
    </div>
    <dl>
      <div><dt>Cost change</dt><dd>NGN {signed(delta.costNgn)}</dd></div>
      <div><dt>Planning Fit change</dt><dd>{signed(delta.planningFit)}</dd></div>
      <div><dt>Evidence change</dt><dd>{signed(delta.evidenceScore)}</dd></div>
      <div>
        <dt>{delta.comparable ? delta.deliveryLabel : "Objective delivery"} change</dt>
        <dd>{delta.eligibleDelivery === null
          ? "Not subtracted · " + (delta.reasonCode ?? "Unavailable")
          : signed(delta.eligibleDelivery) + " " + delta.deliveryUnit}</dd>
      </div>
      <div><dt>Changed zones</dt><dd>{delta.changedZoneIds.join(", ") || "None"}</dd></div>
      <div><dt>Changed sites</dt><dd>{delta.changedSiteIds.join(", ") || "None"}</dd></div>
      <div><dt>Affected pillars</dt><dd>{delta.affectedPillars.join(", ") || "None"}</dd></div>
    </dl>
  </section>;
}

export function AdjustmentsPanel({
  isDirty,
  siteIds,
  zoneIds,
  deltas,
  invalidReasons,
  onInclude,
  onRemove,
  onSwap,
  onReplaceZone,
  onUndo,
  onReset,
}: {
  isDirty: boolean;
  siteIds: string[];
  zoneIds: string[];
  deltas: ReturnType<typeof selectPlanDeltas>;
  invalidReasons: string[];
  onInclude(): void;
  onRemove(siteId: string): void;
  onSwap(): void;
  onReplaceZone(zoneId: string): void;
  onUndo(): void;
  onReset(): void;
}) {
  return (
    <aside aria-label="Plan adjustments">
      <strong>{isDirty ? "Unapplied changes" : "Adjust plan"}</strong>
      {invalidReasons.map((reason) => <p key={reason}>{reason}</p>)}
      {isDirty && deltas && <section aria-label="What changed">
        <h2>What changed?</h2>
        <Comparison label="Applied → proposed" delta={deltas.currentToDraft} />
        <details>
          <summary>Compare with original recommendation</summary>
          <Comparison label="Original → proposed" delta={deltas.originalToDraft} />
        </details>
      </section>}
      <button type="button" onClick={onInclude}>Include compatible face</button>
      <button type="button" onClick={onSwap}>Swap first face in its zone</button>
      {zoneIds.map((zoneId) => (
        <button key={zoneId} type="button" onClick={() => onReplaceZone(zoneId)}>
          Replace zone {zoneId}
        </button>
      ))}
      {siteIds.map((siteId) => (
        <button key={siteId} type="button" onClick={() => onRemove(siteId)}>
          Remove {siteId}
        </button>
      ))}
      <button type="button" onClick={onUndo}>Undo</button>
      <button type="button" onClick={onReset}>Reset to original</button>
    </aside>
  );
}
