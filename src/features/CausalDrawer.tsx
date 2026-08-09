import { useEffect, useRef } from "react";
import type { EstimatePackageResult } from "@/contracts/metrics";
import type { DrawerTarget } from "@/contracts/renderer";

const labels = {
  location: "Location",
  places: "Places",
  movement: "Movement",
  ots: "OTS",
  target: "Target",
  unique: "Unique",
} as const;

const stageExplanations = {
  location: "Starts with the exact selected site or package geography used by the plan.",
  places: "Connects that geography to the governed context available for this Evidence-D planning scenario.",
  movement: "Estimates the movement opportunity associated with the selected sites for the campaign time window.",
  ots: "Applies the available orientation, view-zone and delivery inputs to estimate opportunities to see.",
  target: "Maps opportunities to the governed target audience definition used for this campaign.",
  unique: "Combines overlapping opportunities into the package-level delivery claim shown to the planner.",
} as const;

const pillarDescriptions = {
  A: "Audience / objective alignment",
  C: "Conversion context",
  P: "Portfolio coverage",
  E: "Relative economics",
} as const;

function targetKey(target: DrawerTarget): string {
  return target.kind + "/" + ("id" in target ? target.id : "package");
}

export function CausalDrawer({
  measurement,
  target,
  entityLabel,
  scopeNote,
  activeStage,
  ancestors,
  nextTargets,
  sourceRecord,
  onStage,
  onNavigate,
  onAncestor,
  onBack,
  onClose,
}: {
  measurement: EstimatePackageResult;
  target: DrawerTarget;
  entityLabel: string;
  scopeNote: string;
  activeStage: keyof typeof labels;
  ancestors: DrawerTarget[];
  nextTargets: DrawerTarget[];
  sourceRecord: {
    id: string;
    kind: string;
    sector: string | null;
    geographyId: string;
    productScope: string;
    periodStart: string;
    periodEnd: string;
    provenance: string;
    modelUse: string;
  } | null;
  onStage(value: keyof typeof labels): void;
  onNavigate(target: DrawerTarget): void;
  onAncestor(index: number): void;
  onBack(): void;
  onClose(): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
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

  if (target.kind === "pillar" && target.id !== "D") {
    const description = pillarDescriptions[target.id];
    return (
      <aside className="causal-drawer" role="dialog" aria-modal="true" aria-label="How delivery was estimated">
        <header className="causal-drawer-header">
          <button ref={closeRef} type="button" onClick={onClose}>Close</button>
          <div>
            <span>Recommendation explanation</span>
            <h1>Planning Fit · {target.id} pillar</h1>
          </div>
        </header>
        <nav aria-label="Explanation breadcrumb">
          {ancestors.map((ancestor, index) => (
            <button key={targetKey(ancestor)} type="button" onClick={() => onAncestor(index)}>
              {ancestor.kind === "package"
                ? "Recommended package"
                : ancestor.kind + " " + ("id" in ancestor ? ancestor.id : "")}
            </button>
          ))}
          <span aria-current="page">{entityLabel}</span>
          {ancestors.length > 0 && <button type="button" onClick={onBack}>Back</button>}
        </nav>
        <section className="causal-explanation-card">
          <span>What this means</span>
          <strong>{description}</strong>
          <p>This pillar contributes to recommendation fit. It is not a delivery or reach stage.</p>
          <p>{scopeNote}</p>
        </section>
        <section className="causal-boundary-note">
          <strong>Delivery chain boundary</strong>
          <p>Only D · Delivery enters Location → Places → Movement → OTS → Target → Unique.</p>
        </section>
        <details className="causal-audit-details">
          <summary>Audit / calculation details</summary>
          <dl>
            <div><dt>Role</dt><dd>Recommendation score input</dd></div>
            <div><dt>Current MVP source</dt><dd>Frozen site-level `planningScoresBySector` values.</dd></div>
            <div><dt>Evidence state</dt><dd>Assumed / seeded demo input.</dd></div>
            <div><dt>Feature decomposition</dt><dd>Not materialized in the current bundle.</dd></div>
          </dl>
        </details>
      </aside>
    );
  }

  const stage = measurement.stages.find((item) => item.id === activeStage);
  if (!stage) return null;
  const sourceIds = [...new Set([
    ...measurement.claim.sourceIds,
    ...(measurement.influence?.sourceIds ?? []),
  ])].sort();
  return (
    <aside className="causal-drawer" role="dialog" aria-modal="true" aria-label="How delivery was estimated">
      <header className="causal-drawer-header">
        <button ref={closeRef} type="button" onClick={onClose}>Close</button>
        <div>
          <span>Delivery explanation</span>
          <h1>{target.metric === "influence" ? "Influence" : "Reach"} · {entityLabel}</h1>
          <p>{scopeNote}</p>
        </div>
      </header>
      <nav aria-label="Explanation breadcrumb">
        {ancestors.map((ancestor, index) => (
          <button key={targetKey(ancestor)} type="button" onClick={() => onAncestor(index)}>
            {ancestor.kind === "package"
              ? "Recommended package"
              : ancestor.kind + " " + ("id" in ancestor ? ancestor.id : "")}
          </button>
        ))}
        <span aria-current="page">{entityLabel}</span>
        {ancestors.length > 0 && <button type="button" onClick={onBack}>Back</button>}
      </nav>
      <nav className="causal-stage-nav" aria-label="Causal stages">
        {measurement.stages.map((item) => (
          <button
            key={item.id}
            aria-current={activeStage === item.id ? "step" : undefined}
            onClick={() => onStage(item.id as keyof typeof labels)}
          >
            {labels[item.id as keyof typeof labels]}
          </button>
        ))}
      </nav>
      <section className="causal-explanation-card">
        <span>{labels[activeStage]} · what this means</span>
        <p>{stageExplanations[activeStage]}</p>
        <strong className="causal-stage-value">{stage.valueText}</strong>
        <dl className="causal-stage-summary">
          <div><dt>Evidence state</dt><dd>{stage.state}</dd></div>
          <div><dt>Evidence source</dt><dd>{stage.sourceLabel}</dd></div>
        </dl>
        {stage.caveats.length > 0 && (
          <div className="causal-caveats">
            <strong>What to keep in mind</strong>
            {stage.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
          </div>
        )}
        {stage.recoveryAction && (
          <p className="causal-recovery"><strong>To strengthen this stage:</strong> {stage.recoveryAction}</p>
        )}
      </section>

      {activeStage === "unique" && target.metric === "influence" && measurement.influence && (
        <section className="causal-boundary-note">
          <strong>Influence interpretation</strong>
          <p>Influence-weighted exposure coverage; not persuasion or perception.</p>
        </section>
      )}

      {nextTargets.length > 0 && (
        <section className="causal-supporting-detail" aria-label="Drill deeper">
          <h2>View supporting detail</h2>
          <div>
            {nextTargets.map((next) => (
              <button
                key={targetKey(next)}
                type="button"
                onClick={() => onNavigate(next)}
              >
                {next.kind === "pillar"
                  ? next.id + " pillar"
                  : next.kind === "zone"
                    ? "Zone " + next.id
                    : next.kind === "site"
                      ? "Site " + next.id
                      : next.kind === "evidence"
                        ? "Evidence " + next.id
                        : "Recommended package"}
              </button>
            ))}
          </div>
        </section>
      )}

      <details className="causal-audit-details">
        <summary>Audit / calculation details</summary>
        <dl>
          <div><dt>Entity</dt><dd>{target.kind} · {"id" in target ? target.id : "package"}</dd></div>
          <div><dt>Freshness / revision</dt><dd>{stage.freshnessLabel}</dd></div>
          <div><dt>Transformation</dt><dd>{stage.transformation}</dd></div>
          <div><dt>Next mapping</dt><dd>{stage.nextMapping}</dd></div>
        </dl>
        <details>
          <summary>Source IDs</summary>
          <ul>{sourceIds.map((sourceId) => <li key={sourceId}>{sourceId}</li>)}</ul>
        </details>
        {target.kind === "evidence" && sourceRecord && (
          <section>
            <h3>Source record</h3>
            <dl>
              <div><dt>ID</dt><dd>{sourceRecord.id}</dd></div>
              <div><dt>Kind</dt><dd>{sourceRecord.kind}</dd></div>
              <div><dt>Sector / product</dt><dd>{sourceRecord.sector ?? "all"} / {sourceRecord.productScope}</dd></div>
              <div><dt>Geography</dt><dd>{sourceRecord.geographyId}</dd></div>
              <div><dt>Effective period</dt><dd>{sourceRecord.periodStart} → {sourceRecord.periodEnd}</dd></div>
              <div><dt>Provenance / use</dt><dd>{sourceRecord.provenance} / {sourceRecord.modelUse}</dd></div>
            </dl>
          </section>
        )}
      </details>
    </aside>
  );
}
