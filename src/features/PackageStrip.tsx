import type { MetricClaim } from "@/contracts/metrics";
import type { PlanningResult } from "@/contracts/domain";
import { selectPermittedDeliveryView } from "@/application/permittedDeliveryView";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { resolveBriefAudience } from "@/planning/briefNormalization";
import { PUBLIC_COPY, confidenceLabel } from "@/content/plainLanguage";

function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export function PackageStrip({
  plan,
  isDirty,
  canReviewRfq,
  onExplain,
  onReviewRfq,
  showRfqAction = true,
  heading = "Recommended package",
}: {
  plan: PlanningResult;
  isDirty: boolean;
  canReviewRfq: boolean;
  onExplain(metric: "reach" | "influence"): void;
  onReviewRfq(): void;
  showRfqAction?: boolean;
  heading?: string;
}) {
  if (!plan.measurement) return null;
  const claim = plan.measurement.claim;
  const influence = plan.measurement.influence;
  const audience = resolveBriefAudience(frozenLagosBundle, plan.brief);
  const reachRecovery = plan.measurement.stages
    .find((stage) => stage.id === "unique")?.recoveryAction ?? null;
  const delivery = selectPermittedDeliveryView(claim, reachRecovery);
  const influenceClaim: MetricClaim = influence ?? {
    id: "influence-unavailable",
    kind: "unavailable",
    label: PUBLIC_COPY.metrics.priorityAudienceCoverage,
    state: "unavailable",
    evidence: "unavailable",
    unit: "none",
    reasonCode: "QI_UNAVAILABLE",
    sourceIds: [],
    caveats: ["Priority-audience data is required for this campaign type"],
    applicability: "outside",
  };
  const influenceDelivery = selectPermittedDeliveryView(
    influenceClaim,
    influence ? null : "Add current priority-audience data for this campaign type",
  );
  const reachEvidenceScore = plan.measurement.evidence.permittedClaim.score;
  const influenceEvidenceScore = plan.measurement.evidence.influence?.score ?? null;
  const budgetDelta = plan.brief.budgetNgn - plan.recommended.costNgn;

  return (
    <section className="package-strip" data-testid="package-strip">
      <div>
        <strong>{heading}</strong>
        <span>
          {plan.recommended.siteIds.length} media locations · ₦{compact(plan.recommended.costNgn)} planned of ₦{compact(plan.brief.budgetNgn)} budget
        </span>
        <span className={budgetDelta >= 0 ? "budget-headroom" : "budget-overrun"}>
          {budgetDelta >= 0
            ? `₦${compact(budgetDelta)} ${PUBLIC_COPY.budget.remaining.toLowerCase()}`
            : `₦${compact(Math.abs(budgetDelta))} ${PUBLIC_COPY.budget.over.toLowerCase()}`}
        </span>
        <span>
          Audience used · {audience.label}
          {audience.mode === "focused" ? " · chosen for this campaign" : " · standard audience for this campaign type"}
        </span>
      </div>
      <button type="button" onClick={() => onExplain("reach")}>
        <span>{delivery.label} · {delivery.unitLabel} · {delivery.evidenceLabel} {Math.round(reachEvidenceScore)}/100</span>
        <strong>{delivery.valueText}</strong>
        {delivery.recoveryAction && <small>{delivery.recoveryAction}</small>}
      </button>
      <button type="button" onClick={() => onExplain("influence")}>
        <span>{influenceDelivery.label} · {influenceDelivery.evidenceLabel}{influenceEvidenceScore === null
          ? ""
          : " " + Math.round(influenceEvidenceScore) + "/100"}</span>
        <strong>{influenceDelivery.valueText}</strong>
        {influenceDelivery.recoveryAction && <small>{influenceDelivery.recoveryAction}</small>}
      </button>
      <div>
        <span>{PUBLIC_COPY.metrics.planScore}</span>
        <strong>{plan.recommended.planningFit === null
          ? "Unavailable"
          : plan.recommended.planningFit.toFixed(0) + "/100"}</strong>
        <span>{confidenceLabel(plan.recommended.evidenceGrade)} · {Math.round(plan.recommended.evidenceScore)}/100</span>
      </div>
      {showRfqAction && (
        <button
          type="button"
          className="primary"
          disabled={!canReviewRfq}
          onClick={onReviewRfq}
        >
          {isDirty ? "Apply & review supplier request" : PUBLIC_COPY.rfq.action}
        </button>
      )}
    </section>
  );
}
