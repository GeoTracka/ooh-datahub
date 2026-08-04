"use client";

import { useMemo, useReducer, useState } from "react";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import type { MeasurementStage } from "@/contracts/metrics";
import type { DrawerTarget, MapLens } from "@/contracts/renderer";
import {
  buildPlan,
  promoteAlternativeZone,
  recalculatePlan,
  recalculateSelectedSites,
} from "@/application/plannerService";
import { initialPlannerState, plannerReducer } from "@/application/plannerReducer";
import {
  selectIsDirty,
  selectCausalDrawerViewModel,
  selectLensFeatures,
  selectPlanDeltas,
  selectVisiblePlan,
  selectZoneCards,
} from "@/application/plannerSelectors";
import { AdjustmentsPanel } from "@/features/AdjustmentsPanel";
import { BriefPanel } from "@/features/BriefPanel";
import { CausalDrawer } from "@/features/CausalDrawer";
import { LensTabs } from "@/features/LensTabs";
import { PackageStrip } from "@/features/PackageStrip";
import { RecommendationCards } from "@/features/RecommendationCards";
import { RfqDrawer } from "@/features/RfqDrawer";
import { MapCanvas } from "@/maps/MapCanvas";
import { projectMapLibreScene } from "@/maps/projectScene";
import { siteDeliveryCompatible } from "@/planning/movement";

const initialBrief: Brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

export function PlannerPage() {
  const [brief, setBrief] = useState(initialBrief);
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const [lens, setLens] = useState<MapLens>("plan");
  const [drawer, setDrawer] = useState<{
    target: DrawerTarget;
    stage: MeasurementStage["id"];
    history: DrawerTarget[];
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const visible = selectVisiblePlan(state);
  const dirty = selectIsDirty(state);
  const cards = visible ? selectZoneCards(bundle, state) : [];
  const deltas = selectPlanDeltas(state);
  const drawerView = drawer && visible
    ? selectCausalDrawerViewModel(bundle, visible, drawer.target)
    : null;
  const target = drawer?.target;
  const selectedZoneId = target?.kind === "zone"
    ? target.id
    : target?.kind === "site"
      ? bundle.sites.find((site) => site.id === target.id)?.zoneId ?? null
      : target?.kind === "evidence"
        ? bundle.sites.find((site) => site.id === target.siteId)?.zoneId ?? null
      : null;
  const scene = useMemo(
    () => projectMapLibreScene(selectLensFeatures(bundle, state, lens)),
    [state, lens],
  );

  function changeBrief(change: Partial<Brief>) {
    setBrief((current) => ({ ...current, ...change }));
    if (visible) {
      dispatch({
        type: "drafted",
        plan: recalculatePlan(bundle, visible, change),
        reason: "Brief change · " + Object.keys(change).sort().join(", "),
      });
    }
  }
  function draftSites(siteIds: string[], reason = "Selected-face change") {
    if (!visible) return;
    dispatch({
      type: "drafted",
      plan: recalculateSelectedSites(bundle, visible, siteIds),
      reason,
    });
  }
  function includeFace() {
    if (!visible) return;
    const addition = bundle.sites.find((site) =>
      visible.selectedZoneIds.includes(site.zoneId) &&
      !visible.recommended.siteIds.includes(site.id) &&
      siteDeliveryCompatible(site, visible.brief.flightStart, visible.brief.flightEnd),
    );
    if (addition) draftSites(
      [...visible.recommended.siteIds, addition.id],
      "Include compatible face · " + addition.id,
    );
  }
  function swapFirstFace() {
    if (!visible) return;
    const first = bundle.sites.find((site) => site.id === visible.recommended.siteIds[0]);
    if (!first) return;
    const replacement = bundle.sites.find((site) =>
      site.zoneId === first.zoneId &&
      !visible.recommended.siteIds.includes(site.id) &&
      siteDeliveryCompatible(site, visible.brief.flightStart, visible.brief.flightEnd),
    );
    if (replacement) draftSites(
      [replacement.id, ...visible.recommended.siteIds.slice(1)],
      "Swap face · " + first.id + " → " + replacement.id,
    );
  }
  function replaceZone(zoneId: string) {
    if (!visible) return;
    dispatch({
      type: "drafted",
      plan: promoteAlternativeZone(bundle, visible, zoneId),
      reason: "Replace zone · " + zoneId,
    });
  }
  function openDrawer(target: DrawerTarget, history: DrawerTarget[] = []) {
    setDrawer({
      target,
      stage: target.kind === "package" || target.metric === "influence"
        ? "unique"
        : "location",
      history,
    });
  }
  function navigateDrawer(target: DrawerTarget) {
    setDrawer((current) => current ? {
      target,
      stage: target.kind === "package" || target.metric === "influence"
        ? "unique"
        : "location",
      history: [...current.history, current.target],
    } : current);
  }
  function reviewRfq() {
    if (!visible?.recommended.valid) return;
    dispatch({ type: dirty ? "apply-and-review-rfq" : "review-rfq" });
  }
  function undoDraft() {
    const previous = state.draftHistory.at(-1) ?? state.appliedPlan;
    if (previous) setBrief(previous.brief);
    dispatch({ type: "undo" });
  }
  function resetDraft() {
    if (state.originalPlan) setBrief(state.originalPlan.brief);
    dispatch({ type: "reset" });
  }

  return (
    <main className="planner-shell">
      <BriefPanel
        brief={brief}
        onChange={changeBrief}
        onBuild={() => dispatch({ type: "loaded", plan: buildPlan(bundle, brief) })}
        onUpload={() => setUploadOpen(true)}
      />
      <section className="map-region" aria-label="Campaign map">
        <LensTabs
          active={lens}
          onChange={setLens}
          influenceAvailable={Boolean(visible?.measurement?.influence)}
        />
        <MapCanvas
          scene={scene}
          selectedFeatureId={selectedZoneId}
          onFeatureSelect={(zoneId) => openDrawer({
            kind: "zone",
            id: zoneId,
            metric: lens === "influence" ? "influence" : "reach",
          })}
        />
        {visible && <RecommendationCards
          cards={cards}
          objective={visible.brief.objective}
          selectedZoneId={selectedZoneId}
          onZone={(zoneId) => openDrawer({
            kind: "zone",
            id: zoneId,
            metric: visible.brief.objective === "influential_core" ? "influence" : "reach",
          })}
          onSite={(siteId) => {
            const zoneId = bundle.sites.find((site) => site.id === siteId)!.zoneId;
            const metric = visible.brief.objective === "influential_core" ? "influence" : "reach";
            openDrawer(
              { kind: "site", id: siteId, metric },
              [{ kind: "zone", id: zoneId, metric }],
            );
          }}
        />}
      </section>
      {visible &&
        <PackageStrip
          plan={visible}
          isDirty={dirty}
          canReviewRfq={visible.recommended.valid}
          onExplain={(metric) => openDrawer({ kind: "package", metric })}
          onReviewRfq={reviewRfq}
        />
      }
      {visible && (
        <AdjustmentsPanel
          isDirty={dirty}
          siteIds={visible.recommended.siteIds}
          zoneIds={visible.selectedZoneIds}
          deltas={deltas}
          invalidReasons={visible.recommended.invalidReasonCodes}
          onInclude={includeFace}
          onRemove={(siteId) => draftSites(
            visible.recommended.siteIds.filter((id) => id !== siteId),
            "Remove face · " + siteId,
          )}
          onSwap={swapFirstFace}
          onReplaceZone={replaceZone}
          onUndo={undoDraft}
          onReset={resetDraft}
        />
      )}
      {drawer && drawerView && (
        <CausalDrawer
          measurement={drawerView.measurement}
          target={drawer.target}
          entityLabel={drawerView.label}
          scopeNote={drawerView.scopeNote}
          activeStage={drawer.stage}
          ancestors={drawer.history}
          nextTargets={drawerView.nextTargets}
          sourceRecord={drawerView.sourceRecord}
          onStage={(stage) => setDrawer((current) => current ? { ...current, stage } : current)}
          onNavigate={navigateDrawer}
          onAncestor={(index) => setDrawer((current) => {
            if (!current || !current.history[index]) return current;
            return {
              target: current.history[index],
              stage: "location",
              history: current.history.slice(0, index),
            };
          })}
          onBack={() => setDrawer((current) => {
            if (!current || current.history.length === 0) return current;
            const target = current.history.at(-1)!;
            return { target, stage: "location", history: current.history.slice(0, -1) };
          })}
          onClose={() => setDrawer(null)}
        />
      )}
      {uploadOpen && <div role="dialog" aria-label="Upload inventory" />}
      {state.status === "rfq" && state.appliedPlan && (
        <RfqDrawer
          plan={state.appliedPlan}
          onClose={() => dispatch({ type: "close-rfq" })}
          onScheduleRevision={(flightStart, flightEnd) => {
            const revised = recalculatePlan(bundle, state.appliedPlan!, {
              flightStart,
              flightEnd,
            });
            setBrief(revised.brief);
            dispatch({ type: "close-rfq-with-draft", plan: revised });
          }}
        />
      )}
    </main>
  );
}
