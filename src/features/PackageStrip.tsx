import type { MetricClaim } from "@/contracts/metrics";
import type { PlanningResult } from "@/contracts/domain";
import { selectPermittedDeliveryView } from "@/application/permittedDeliveryView";

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
}: {
  plan: PlanningResult;
  isDirty: boolean;
  canReviewRfq: boolean;
  onExplain(metric: "reach" | "influence"): void;
  onReviewRfq(): void;
}) {
  if (!plan.measurement) return null;
  const claim = plan.measurement.claim;
  const influence = plan.measurement.influence;
  const reachRecovery = plan.measurement.stages
    .find((stage) => stage.id === "unique")?.recoveryAction ?? null;
  const delivery = selectPermittedDeliveryView(claim, reachRecovery);
  const influenceClaim: MetricClaim = influence ?? {
    id: "influence-unavailable",
    kind: "unavailable",
    label: "Influence Capture",
    state: "unavailable",
    evidence: "unavailable",
    unit: "none",
    reasonCode: "QI_UNAVAILABLE",
    sourceIds: [],
    caveats: ["A named category-specific influence propensity source is required"],
    applicability: "outside",
  };
  const influenceDelivery = selectPermittedDeliveryView(
    influenceClaim,
    influence ? null : "Attach a named category-specific influence propensity source",
  );
  const reachEvidenceScore = plan.measurement.evidence.permittedClaim.score;
  const influenceEvidenceScore = plan.measurement.evidence.influence?.score ?? null;

  return (
    <section className="package-strip" data-testid="package-strip">
      <div>
        <strong>Recommended package</strong>
        <span>{plan.recommended.siteIds.length} sites · ₦{compact(plan.recommended.costNgn)}</span>
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
        <span>Planning Fit</span>
        <strong>{plan.recommended.planningFit === null
          ? "Unavailable"
          : plan.recommended.planningFit.toFixed(0) + "/100"}</strong>
        <span>Recommendation evidence {plan.recommended.evidenceGrade} · {Math.round(plan.recommended.evidenceScore)}/100</span>
      </div>
      <button
        type="button"
        className="primary"
        disabled={!canReviewRfq}
        onClick={onReviewRfq}
      >
        {isDirty ? "Apply & review RFQ" : "Review RFQ"}
      </button>
    </section>
  );
}
