import type {
  PackageCandidate,
  PackageOptionStyle,
  PlanningResult,
} from "@/contracts/domain";
import { PUBLIC_COPY } from "@/content/plainLanguage";

const styleCopy: Record<PackageOptionStyle, {
  label: string;
  description: string;
}> = {
  best_overall: {
    label: "Best overall",
    description: PUBLIC_COPY.package.bestOverallDescription,
  },
  maximum_delivery: {
    label: "Maximum delivery",
    description: PUBLIC_COPY.package.maximumDeliveryDescription,
  },
  budget_smart: {
    label: "Budget smart",
    description: PUBLIC_COPY.package.budgetSmartDescription,
  },
};

const deliveryCopy: Record<PlanningResult["brief"]["objective"], {
  label: string;
  suffix: string;
}> = {
  broad_reach: { label: PUBLIC_COPY.metrics.estimatedReach, suffix: " people" },
  influential_core: { label: PUBLIC_COPY.metrics.priorityAudienceReach, suffix: " people" },
  near_conversion: { label: PUBLIC_COPY.metrics.likelyCustomerReach, suffix: " people" },
};

function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export function PackageOptionComparison({
  plan,
  selectedPackageId,
  onSelect,
}: {
  plan: PlanningResult;
  selectedPackageId: string;
  onSelect(candidate: PackageCandidate): void;
}) {
  const delivery = deliveryCopy[plan.brief.objective];
  const optionCount = plan.packageOptions.length;

  return (
    <section className="package-options" aria-labelledby="package-options-title">
      <div className="package-options-intro">
        <div>
          <span className="package-options-kicker">
            {optionCount} {optionCount === 1 ? "way" : "ways"} to plan
          </span>
          <h2 id="package-options-title">Compare packages by approach</h2>
        </div>
        <p>Each option uses your audience, objective, timing, and budget.</p>
      </div>

      {optionCount < 3 && (
        <p className="package-options-limited" role="note">
          Available inventory or campaign dates limited this comparison. Adjust any package
          to resolve the issue or create a custom plan.
        </p>
      )}

      <div className="package-option-grid" role="radiogroup" aria-label="Planning approaches">
        {plan.packageOptions.map((option) => {
          const candidate = option.candidate;
          const copy = styleCopy[option.style];
          const selected = candidate.id === selectedPackageId;
          const headroom = plan.brief.budgetNgn - candidate.costNgn;
          return (
            <label
              key={option.style}
              className={selected ? "package-option-card selected" : "package-option-card"}
              data-style={option.style}
            >
              <input
                type="radio"
                name="package-approach"
                value={candidate.id}
                checked={selected}
                onChange={() => onSelect(candidate)}
              />
              <span className="package-option-card-body">
                <span className="package-option-heading">
                  <span>
                    <span className="package-option-style">{copy.label}</span>
                    {option.style === "best_overall" && (
                      <span className="package-option-recommended">Recommended</span>
                    )}
                  </span>
                  <span className="package-option-selection">
                    {selected ? "Selected" : "Choose"}
                  </span>
                </span>
                <span className="package-option-description">{copy.description}</span>
                <span className="package-option-metrics">
                  <span>
                    <small>{delivery.label}</small>
                    <strong>
                      {candidate.deliveryRaw === null
                        ? "Unavailable"
                        : (
                          <>
                            <span className="package-option-metric-number">
                              {compact(candidate.deliveryRaw)}
                            </span>
                            <small className="package-option-metric-unit">
                              {" "}{delivery.suffix.trim()}
                            </small>
                          </>
                        )}
                    </strong>
                  </span>
                  <span>
                    <small>{PUBLIC_COPY.metrics.planScore}</small>
                    <strong>
                      {candidate.planningFit === null
                        ? "Unavailable"
                        : `${candidate.planningFit.toFixed(0)}/100`}
                    </strong>
                  </span>
                  <span>
                    <small>Planned cost</small>
                    <strong>₦{compact(candidate.costNgn)}</strong>
                  </span>
                </span>
                <span className="package-option-footnote">
                  <span>{candidate.zoneIds.length} areas · {candidate.siteIds.length} media locations</span>
                  <span className={headroom >= 0 ? "budget-headroom" : "budget-overrun"}>
                    {headroom >= 0
                      ? `₦${compact(headroom)} ${PUBLIC_COPY.budget.remaining.toLowerCase()}`
                      : `₦${compact(Math.abs(headroom))} ${PUBLIC_COPY.budget.over.toLowerCase()}`}
                  </span>
                </span>
                {!candidate.valid && (
                  <span className="package-option-invalid">Needs fine-tuning before continuing</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
