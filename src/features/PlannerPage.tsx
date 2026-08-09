"use client";

import { useMemo, useReducer, useState } from "react";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import type { MeasurementStage } from "@/contracts/metrics";
import type { DrawerTarget, MapLens } from "@/contracts/renderer";
import {
  applyUploadContextToPlan,
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
import { selectUploadedContextComparisons } from "@/application/uploadContextSelectors";
import { ActionDock } from "@/features/ActionDock";
import { AdjustmentsPanel } from "@/features/AdjustmentsPanel";
import { CausalDrawer } from "@/features/CausalDrawer";
import { LensTabs } from "@/features/LensTabs";
import { MapStage } from "@/features/MapStage";
import { PackageStrip } from "@/features/PackageStrip";
import { RecommendationCarousel } from "@/features/RecommendationCarousel";
import { RfqDrawer } from "@/features/RfqDrawer";
import { StepCard } from "@/features/StepCard";
import { UploadDialog } from "@/features/UploadDialog";
import { UploadedContextPanel } from "@/features/UploadedContextPanel";
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

type CampaignProfile = Pick<
  Brief,
  "productName" | "productDescription" | "targetAudience" | "sector" | "objective"
>;

type ExplorerStep = 1 | 2 | 3 | 4 | 5;

const campaignPresets: Array<{
  id: string;
  label: string;
  profile: CampaignProfile;
}> = [
  {
    id: "fmcg-broad-reach",
    label: "FMCG · Broad reach",
    profile: {
      productName: "Demo Spark",
      productDescription: "Affordable on-the-go refreshment launch",
      targetAudience: "Students, young workers, and convenience shoppers",
      sector: "fmcg",
      objective: "broad_reach",
    },
  },
  {
    id: "real-estate-influential-core",
    label: "Real Estate · Influential core",
    profile: {
      productName: "Harbour Residences",
      productDescription: "Premium Lagos residential development for buyers and investors",
      targetAudience: "Affluent professionals, property investors, and diaspora buyers",
      sector: "real_estate",
      objective: "influential_core",
    },
  },
  {
    id: "bank-fintech-near-conversion",
    label: "Bank / Fintech · Near conversion",
    profile: {
      productName: "SwiftPay Business",
      productDescription: "Digital banking and payments for everyday business transactions",
      targetAudience: "SME owners, merchants, and salaried professionals",
      sector: "bank_fintech",
      objective: "near_conversion",
    },
  },
];

const daypartChoices: Array<{ value: Brief["daypart"]; label: string }> = [
  { value: "all_day", label: "All day" },
  { value: "am", label: "AM" },
  { value: "midday", label: "Midday" },
  { value: "pm", label: "PM" },
  { value: "evening", label: "Evening" },
];

const budgetChoices = [15_000_000, 18_000_000, 20_000_000, 25_000_000];

function profileMatches(brief: Brief, profile: CampaignProfile): boolean {
  return brief.productName === profile.productName &&
    brief.productDescription === profile.productDescription &&
    brief.targetAudience === profile.targetAudience &&
    brief.sector === profile.sector &&
    brief.objective === profile.objective;
}

function briefsMatch(left: Brief, right: Brief): boolean {
  return left.productName === right.productName &&
    left.productDescription === right.productDescription &&
    left.targetAudience === right.targetAudience &&
    left.sector === right.sector &&
    left.objective === right.objective &&
    left.daypart === right.daypart &&
    left.budgetNgn === right.budgetNgn &&
    left.normalizationBudgetNgn === right.normalizationBudgetNgn &&
    left.flightStart === right.flightStart &&
    left.flightEnd === right.flightEnd;
}

export function PlannerPage() {
  const [brief, setBrief] = useState(initialBrief);
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const [step, setStep] = useState<ExplorerStep>(1);
  const [lens, setLens] = useState<MapLens>("plan");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
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
  const uploadedContextRows = visible
    ? selectUploadedContextComparisons(bundle, visible)
    : [];
  const drawerView = drawer && visible
    ? selectCausalDrawerViewModel(bundle, visible, drawer.target)
    : null;
  const influenceAvailable = Boolean(visible?.measurement?.influence);
  const resolvedLens: MapLens = lens === "influence" && !influenceAvailable
    ? "plan"
    : lens;
  const selectedPresetId = campaignPresets.find((preset) =>
    profileMatches(brief, preset.profile)
  )?.id ?? null;
  const scene = useMemo(
    () => projectMapLibreScene(selectLensFeatures(bundle, state, resolvedLens)),
    [state, resolvedLens],
  );

  function changeBrief(change: Partial<Brief>) {
    setBrief((current) => ({ ...current, ...change }));
  }

  function applyPreset(profile: CampaignProfile) {
    setBrief((current) => ({ ...current, ...profile }));
  }

  function showRecommendations() {
    let plan = visible;
    if (!visible) {
      plan = buildPlan(bundle, brief);
      dispatch({ type: "loaded", plan });
    } else if (!briefsMatch(visible.brief, brief)) {
      plan = recalculatePlan(bundle, visible, brief);
      dispatch({
        type: "drafted",
        plan,
        reason: "Campaign brief updated",
      });
    }
    if (!plan) return;
    setSelectedZoneId(plan.selectedZoneIds[0] ?? null);
    setLens("plan");
    setStep(3);
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
    const next = promoteAlternativeZone(bundle, visible, zoneId);
    dispatch({
      type: "drafted",
      plan: next,
      reason: "Replace zone · " + zoneId,
    });
    setSelectedZoneId(next.selectedZoneIds[0] ?? null);
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

  function openZoneStory(zoneId: string) {
    if (!visible) return;
    openDrawer({
      kind: "zone",
      id: zoneId,
      metric: visible.brief.objective === "influential_core" ? "influence" : "reach",
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
    if (previous) {
      setBrief(previous.brief);
      setSelectedZoneId(previous.selectedZoneIds[0] ?? null);
    }
    dispatch({ type: "undo" });
  }

  function resetDraft() {
    if (state.originalPlan) {
      setBrief(state.originalPlan.brief);
      setSelectedZoneId(state.originalPlan.selectedZoneIds[0] ?? null);
    }
    dispatch({ type: "reset" });
  }

  const stepTwoValid = brief.budgetNgn > 0 && brief.flightStart <= brief.flightEnd;

  return (
    <main className="explorer-shell">
      <MapStage
        scene={scene}
        selectedFeatureId={selectedZoneId}
        onFeatureSelect={(featureId) => {
          if (cards.some((card) => card.zoneId === featureId)) {
            setSelectedZoneId(featureId);
          }
        }}
      />

      {visible && (
        <div className="explorer-lenses">
          <LensTabs
            active={lens}
            onChange={setLens}
            influenceAvailable={influenceAvailable}
          />
        </div>
      )}

      <div className="explorer-card-rail">
        {step === 1 && (
          <StepCard
            step={1}
            total={5}
            title="Who is this campaign for?"
            primaryAction={{ label: "Continue to timing", onClick: () => setStep(2) }}
          >
            <div className="explorer-preset-grid" aria-label="Campaign presets">
              {campaignPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selectedPresetId === preset.id}
                  onClick={() => applyPreset(preset.profile)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="explorer-fields">
              <label>
                Product name
                <input value={brief.productName} onChange={(event) => changeBrief({ productName: event.target.value })} />
              </label>
              <label>
                Product information
                <textarea value={brief.productDescription} onChange={(event) => changeBrief({ productDescription: event.target.value })} />
              </label>
              <label>
                Target audience
                <textarea value={brief.targetAudience} onChange={(event) => changeBrief({ targetAudience: event.target.value })} />
              </label>
              <div className="explorer-field-pair">
                <label>
                  Sector
                  <select value={brief.sector} onChange={(event) => changeBrief({ sector: event.target.value as Brief["sector"] })}>
                    <option value="fmcg">FMCG</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="bank_fintech">Bank / Fintech</option>
                  </select>
                </label>
                <label>
                  Objective
                  <select value={brief.objective} onChange={(event) => changeBrief({ objective: event.target.value as Brief["objective"] })}>
                    <option value="broad_reach">Broad reach</option>
                    <option value="influential_core">Influential core</option>
                    <option value="near_conversion">Near conversion</option>
                  </select>
                </label>
              </div>
            </div>
            <button
              type="button"
              className="explorer-link-button explorer-skip"
              onClick={showRecommendations}
            >
              Use default timing & budget
            </button>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard
            step={2}
            total={5}
            title="When and how much?"
            onBack={() => setStep(1)}
            primaryAction={{
              label: "Show recommended zones",
              onClick: showRecommendations,
              disabled: !stepTwoValid,
            }}
          >
            <div className="explorer-choice-group">
              <span>Campaign time</span>
              <div className="explorer-chip-row" role="group" aria-label="Campaign time">
                {daypartChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={brief.daypart === choice.value}
                    onClick={() => changeBrief({ daypart: choice.value })}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="explorer-choice-group">
              <span>Budget</span>
              <div className="explorer-chip-row" role="group" aria-label="Budget options">
                {budgetChoices.map((budget) => (
                  <button
                    key={budget}
                    type="button"
                    aria-pressed={brief.budgetNgn === budget}
                    onClick={() => changeBrief({ budgetNgn: budget })}
                  >
                    ₦{budget / 1_000_000}M
                  </button>
                ))}
              </div>
              <label>
                Budget (NGN)
                <input
                  type="number"
                  min={1}
                  value={brief.budgetNgn}
                  onChange={(event) => changeBrief({ budgetNgn: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="explorer-field-pair">
              <label>
                Flight start
                <input type="date" value={brief.flightStart} onChange={(event) => changeBrief({ flightStart: event.target.value })} />
              </label>
              <label>
                Flight end
                <input type="date" value={brief.flightEnd} onChange={(event) => changeBrief({ flightEnd: event.target.value })} />
              </label>
            </div>
            {!stepTwoValid && <p role="alert">Budget must be positive and flight end must not precede flight start.</p>}
          </StepCard>
        )}

        {step === 3 && visible && (
          <StepCard
            step={3}
            total={5}
            title="Recommended package"
            onBack={() => setStep(2)}
            primaryAction={{
              label: "This package works",
              onClick: () => setStep(4),
              disabled: !visible.recommended.valid,
            }}
          >
            <RecommendationCarousel
              cards={cards}
              objective={visible.brief.objective}
              selectedZoneId={selectedZoneId}
              onSelect={setSelectedZoneId}
              onExplain={openZoneStory}
            />
            <PackageStrip
              plan={visible}
              isDirty={dirty}
              canReviewRfq={visible.recommended.valid}
              showRfqAction={false}
              onExplain={(metric) => openDrawer({ kind: "package", metric })}
              onReviewRfq={reviewRfq}
            />
            {!visible.recommended.valid && (
              <section role="alert" aria-label="Package constraints">
                <strong>Package needs repair before acceptance</strong>
                {visible.recommended.invalidReasonCodes.map((reason) => <p key={reason}>{reason}</p>)}
              </section>
            )}
            {visible.contextRevision && (
              <aside className="explorer-context-status" aria-label="Uploaded planning status">
                <strong>Customer inventory · context only</strong>
                <span>{visible.contextRevision.selectedRows.length} reviewed rows</span>
                <span>{visible.contextRevision.claimResolution.reasonCode}</span>
                <span>{dirty ? "Unapplied context change" : "Applied plan context"}</span>
              </aside>
            )}
            {visible.contextRevision && (
              <UploadedContextPanel rows={uploadedContextRows} />
            )}
          </StepCard>
        )}

        {step === 4 && visible && (
          <StepCard
            step={4}
            total={5}
            title="What would you like to do with this package?"
            onBack={() => setStep(3)}
          >
            <ActionDock
              canReviewRfq={visible.recommended.valid}
              onReviewRfq={reviewRfq}
              onUpload={() => setUploadOpen(true)}
              onFineTune={() => setStep(5)}
            />
          </StepCard>
        )}

        {step === 5 && visible && (
          <StepCard
            step={5}
            total={5}
            title="Make this package yours"
            onBack={() => setStep(4)}
            primaryAction={{
              label: dirty ? "Apply & review RFQ" : "Review RFQ",
              onClick: reviewRfq,
              disabled: !visible.recommended.valid,
            }}
          >
            <PackageStrip
              plan={visible}
              isDirty={dirty}
              canReviewRfq={visible.recommended.valid}
              showRfqAction={false}
              onExplain={(metric) => openDrawer({ kind: "package", metric })}
              onReviewRfq={reviewRfq}
            />
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
          </StepCard>
        )}
      </div>

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
          onStage={(activeStage) => setDrawer((current) => current ? { ...current, stage: activeStage } : current)}
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

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onDraft={(contextRevision) => {
            const basis = visible ?? buildPlan(bundle, brief);
            if (!visible) dispatch({ type: "loaded", plan: basis });
            const next = applyUploadContextToPlan(bundle, basis, contextRevision);
            dispatch({
              type: "drafted",
              plan: next,
              reason: "Apply uploaded context · " + contextRevision.dataRevision,
            });
            setSelectedZoneId(next.selectedZoneIds[0] ?? null);
            setLens("plan");
            setStep(3);
            setUploadOpen(false);
          }}
        />
      )}

      {state.status === "rfq" && state.appliedPlan && (
        <RfqDrawer
          plan={state.appliedPlan}
          onClose={() => {
            dispatch({ type: "close-rfq" });
            setStep(4);
          }}
          onScheduleRevision={(flightStart, flightEnd) => {
            const revised = recalculatePlan(bundle, state.appliedPlan!, {
              flightStart,
              flightEnd,
            });
            setBrief(revised.brief);
            dispatch({ type: "close-rfq-with-draft", plan: revised });
            setStep(5);
          }}
        />
      )}
    </main>
  );
}
