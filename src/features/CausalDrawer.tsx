import { useEffect, useRef } from "react";
import type { EstimatePackageResult } from "@/contracts/metrics";
import type { DrawerTarget } from "@/contracts/renderer";
import { PlannerDrawerFrame } from "@/features/PlannerDrawerFrame";
import { PUBLIC_COPY } from "@/content/plainLanguage";

const labels = {
  ...PUBLIC_COPY.explanation.stages,
} as const;

const pillarDescriptions = {
  A: "How well the locations match the selected audience and campaign goal",
  C: "How close the locations are to places where customers can act",
  P: "How well the locations spread the campaign across Lagos",
  E: "How much audience value the package provides for its cost",
} as const;

function friendlySourceLabel(sourceId: string): string {
  if (/feature|geometry|visibility/i.test(sourceId)) return "Media location and visibility data";
  if (/movement/i.test(sourceId)) return "Movement estimate";
  if (/target|influence|serviceability/i.test(sourceId)) return "Audience information";
  if (/overlap|panel|replicate/i.test(sourceId)) return "Audience reach method";
  if (/schedule/i.test(sourceId)) return "Campaign schedule";
  return "Campaign planning data";
}

function breadcrumbLabel(target: DrawerTarget): string {
  if (target.kind === "package") return "Recommended package";
  if (target.kind === "pillar") return target.id + " score area";
  if (target.kind === "zone") return "Area";
  if (target.kind === "site") return "Media location";
  return "Source information";
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const friendlySources = [...new Set([
    ...measurement.claim.sourceIds,
    ...(measurement.influence?.sourceIds ?? []),
  ].map(friendlySourceLabel))].sort();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
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

  if (target.kind === "pillar" && target.id !== "D") {
    const description = pillarDescriptions[target.id];
    return (
      <PlannerDrawerFrame
        ariaLabel={PUBLIC_COPY.explanation.title}
        eyebrow={PUBLIC_COPY.explanation.eyebrow}
        className="causal-drawer"
        dialogRef={dialogRef}
        closeRef={closeRef}
        onClose={onClose}
      >
        <nav className="planner-drawer-breadcrumb" aria-label="Explanation breadcrumb">
          {ancestors.map((ancestor, index) => (
            <button key={ancestor.kind + "/" + ("id" in ancestor ? ancestor.id : "package")} type="button" onClick={() => onAncestor(index)}>
              {breadcrumbLabel(ancestor)}
            </button>
          ))}
          <span aria-current="page">{entityLabel}</span>
          {ancestors.length > 0 && <button type="button" onClick={onBack}>Back</button>}
        </nav>
        <h1>{PUBLIC_COPY.metrics.planScore} · {target.id} area</h1>
        <p>{description}</p>
        <dl>
          <div><dt>What it does</dt><dd>Helps compare and rank package options</dd></div>
          <div><dt>Used in the audience estimate</dt><dd>No — only the D · Delivery area feeds into the audience estimate.</dd></div>
          <div><dt>Data used</dt><dd>Location-level planning scores for the selected campaign type.</dd></div>
          <div><dt>{PUBLIC_COPY.explanation.confidence}</dt><dd>Early estimate</dd></div>
        </dl>
        <p>
          A location-by-location breakdown is not available for this score area yet.
          It is shown as a package-ranking input, not as audience delivery.
        </p>
        <p>{scopeNote}</p>
      </PlannerDrawerFrame>
    );
  }

  const stage = measurement.stages.find((item) => item.id === activeStage);
  if (!stage) return null;
  return (
    <PlannerDrawerFrame
      ariaLabel={PUBLIC_COPY.explanation.title}
      eyebrow={PUBLIC_COPY.explanation.eyebrow}
      className="causal-drawer"
      dialogRef={dialogRef}
      closeRef={closeRef}
      onClose={onClose}
    >
      <nav className="planner-drawer-breadcrumb" aria-label="Explanation breadcrumb">
        {ancestors.map((ancestor, index) => (
          <button key={ancestor.kind + "/" + ("id" in ancestor ? ancestor.id : "package")} type="button" onClick={() => onAncestor(index)}>
            {breadcrumbLabel(ancestor)}
          </button>
        ))}
        <span aria-current="page">{entityLabel}</span>
        {ancestors.length > 0 && (
          <button type="button" onClick={onBack}>Back</button>
        )}
      </nav>
      <h1>{target.metric === "influence" ? "Priority-audience reach" : "Estimated reach"} · {entityLabel}</h1>
      <p>{scopeNote}</p>
      <nav className="causal-stage-navigation" aria-label={PUBLIC_COPY.explanation.title}>
        {measurement.stages.map((stageItem) => (
          <button
            key={stageItem.id}
            aria-current={activeStage === stageItem.id ? "step" : undefined}
            onClick={() => onStage(stageItem.id as keyof typeof labels)}
          >
            {labels[stageItem.id as keyof typeof labels]}
          </button>
        ))}
      </nav>
      <section className="causal-stage-detail">
        <h2>{labels[activeStage]}</h2>
        <strong>{stage.valueText}</strong>
        <dl>
          <div><dt>Selection</dt><dd>{entityLabel}</dd></div>
          <div><dt>Estimate type</dt><dd>{stage.state === "modelled" ? "Calculated estimate" : stage.state === "assumed" ? "Planning estimate" : "Unavailable"}</dd></div>
          <div><dt>Data used</dt><dd>{stage.sourceLabel}</dd></div>
          <div><dt>Data date / version</dt><dd>{stage.freshnessLabel}</dd></div>
          <div><dt>How it was calculated</dt><dd>{stage.transformation}</dd></div>
          <div><dt>Next step</dt><dd>{stage.nextMapping}</dd></div>
        </dl>
        {stage.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
        {stage.recoveryAction && <p>What to do: {stage.recoveryAction}</p>}
        <details>
          <summary>Sources used</summary>
          <ul>{friendlySources.map((source) => <li key={source}>{source}</li>)}</ul>
        </details>
        {target.kind === "evidence" && sourceRecord && <section>
          <h3>Source information</h3>
          <dl>
            <div><dt>Source</dt><dd>{friendlySourceLabel(sourceRecord.id)}</dd></div>
            <div><dt>Campaign type</dt><dd>{sourceRecord.sector === "fmcg" ? "Consumer goods" : sourceRecord.sector === "real_estate" ? "Real Estate" : sourceRecord.sector === "bank_fintech" ? "Bank / Fintech" : "All campaign types"}</dd></div>
            <div><dt>Market</dt><dd>Lagos</dd></div>
            <div><dt>Available dates</dt><dd>{sourceRecord.periodStart} → {sourceRecord.periodEnd}</dd></div>
            <div><dt>Use</dt><dd>Planning use only</dd></div>
          </dl>
        </section>}
        {activeStage === "unique" && target.metric === "influence" && measurement.influence && (
          <section>
            <h3>Priority audience</h3>
            <p>Estimated coverage of the selected priority audience. This does not measure persuasion or brand perception.</p>
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
                  ? "Area " + next.id
                  : next.kind === "site"
                    ? "Media location " + next.id
                    : next.kind === "evidence"
                      ? "Source: " + friendlySourceLabel(next.id)
                      : "Recommended package"}
            </button>
          ))}
        </section>}
      </section>
    </PlannerDrawerFrame>
  );
}
