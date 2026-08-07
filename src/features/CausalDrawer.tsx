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

const pillarDescriptions = {
  A: "Audience / objective alignment",
  C: "Conversion context",
  P: "Portfolio coverage",
  E: "Relative economics",
} as const;

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
  onCloseRef.current = onClose;
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
      <aside role="dialog" aria-modal="true" aria-label="How delivery was estimated">
        <button ref={closeRef} type="button" onClick={onClose}>Close</button>
        <nav aria-label="Explanation breadcrumb">
          {ancestors.map((ancestor, index) => (
            <button key={ancestor.kind + "/" + ("id" in ancestor ? ancestor.id : "package")} type="button" onClick={() => onAncestor(index)}>
              {ancestor.kind === "package"
                ? "Recommended package"
                : ancestor.kind + " " + ("id" in ancestor ? ancestor.id : "")}
            </button>
          ))}
          <span aria-current="page">{entityLabel}</span>
          {ancestors.length > 0 && <button type="button" onClick={onBack}>Back</button>}
        </nav>
        <h1>Planning Fit · {target.id} pillar</h1>
        <p>{description}</p>
        <dl>
          <div><dt>Role</dt><dd>Recommendation score input</dd></div>
          <div><dt>Delivery chain</dt><dd>Not applicable — only D · Delivery enters the audience-delivery causal chain.</dd></div>
          <div><dt>Current MVP source</dt><dd>Frozen site-level `planningScoresBySector` values.</dd></div>
          <div><dt>Evidence state</dt><dd>Assumed / seeded demo input.</dd></div>
        </dl>
        <p>
          Feature-level decomposition for this pillar is not materialized in the current bundle.
          The UI therefore does not present Location → Unique as an explanation for this score.
        </p>
        <p>{scopeNote}</p>
      </aside>
    );
  }

  const stage = measurement.stages.find((item) => item.id === activeStage);
  if (!stage) return null;
  return (
    <aside role="dialog" aria-modal="true" aria-label="How delivery was estimated">
      <button ref={closeRef} type="button" onClick={onClose}>Close</button>
      <nav aria-label="Explanation breadcrumb">
        {ancestors.map((ancestor, index) => (
          <button key={ancestor.kind + "/" + ("id" in ancestor ? ancestor.id : "package")} type="button" onClick={() => onAncestor(index)}>
            {ancestor.kind === "package"
              ? "Recommended package"
              : ancestor.kind + " " + ("id" in ancestor ? ancestor.id : "")}
          </button>
        ))}
        <span aria-current="page">{entityLabel}</span>
        {ancestors.length > 0 && (
          <button type="button" onClick={onBack}>Back</button>
        )}
      </nav>
      <h1>{target.metric === "influence" ? "Influence" : "Reach"} · {entityLabel}</h1>
      <p>{scopeNote}</p>
      <nav aria-label="Causal stages">
        {measurement.stages.map((stage) => (
          <button
            key={stage.id}
            aria-current={activeStage === stage.id ? "step" : undefined}
            onClick={() => onStage(stage.id as keyof typeof labels)}
          >
            {labels[stage.id as keyof typeof labels]}
          </button>
        ))}
      </nav>
      <section>
        <h2>{labels[activeStage]}</h2>
        <strong>{stage.valueText}</strong>
        <dl>
          <div><dt>Entity</dt><dd>{target.kind} · {"id" in target ? target.id : "package"}</dd></div>
          <div><dt>Evidence state</dt><dd>{stage.state}</dd></div>
          <div><dt>Source</dt><dd>{stage.sourceLabel}</dd></div>
          <div><dt>Freshness / revision</dt><dd>{stage.freshnessLabel}</dd></div>
          <div><dt>Transformation</dt><dd>{stage.transformation}</dd></div>
          <div><dt>Next mapping</dt><dd>{stage.nextMapping}</dd></div>
        </dl>
        {stage.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
        {stage.recoveryAction && <p>Recovery: {stage.recoveryAction}</p>}
        <details>
          <summary>Source IDs</summary>
          <ul>{[...new Set([
            ...measurement.claim.sourceIds,
            ...(measurement.influence?.sourceIds ?? []),
          ])].sort().map((sourceId) => <li key={sourceId}>{sourceId}</li>)}</ul>
        </details>
        {target.kind === "evidence" && sourceRecord && <section>
          <h3>Source record</h3>
          <dl>
            <div><dt>ID</dt><dd>{sourceRecord.id}</dd></div>
            <div><dt>Kind</dt><dd>{sourceRecord.kind}</dd></div>
            <div><dt>Sector / product</dt><dd>{sourceRecord.sector ?? "all"} / {sourceRecord.productScope}</dd></div>
            <div><dt>Geography</dt><dd>{sourceRecord.geographyId}</dd></div>
            <div><dt>Effective period</dt><dd>{sourceRecord.periodStart} → {sourceRecord.periodEnd}</dd></div>
            <div><dt>Provenance / use</dt><dd>{sourceRecord.provenance} / {sourceRecord.modelUse}</dd></div>
          </dl>
        </section>}
        {activeStage === "unique" && target.metric === "influence" && measurement.influence && (
          <section>
            <h3>Influence</h3>
            <p>Influence-weighted exposure coverage; not persuasion or perception.</p>
          </section>
        )}
        {nextTargets.length > 0 && <section aria-label="Drill deeper">
          <h3>View supporting detail</h3>
          {nextTargets.map((next) => (
            <button
              key={next.kind + "/" + ("id" in next ? next.id : "package")}
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
        </section>}
      </section>
    </aside>
  );
}
