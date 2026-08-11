import type {
  PackageCandidate,
  PackageOptionStyle,
  PlanningResult,
} from "@/contracts/domain";

const styleCopy: Record<PackageOptionStyle, {
  label: string;
  description: string;
}> = {
  best_overall: {
    label: "Best overall",
    description: "Strongest balance of delivery, fit, and cost for this brief.",
  },
  maximum_delivery: {
    label: "Maximum delivery",
    description: "Prioritizes the campaign objective across eligible locations.",
  },
  budget_smart: {
    label: "Budget smart",
    description: "Keeps planning fit close while creating more budget flexibility.",
  },
};

const deliveryCopy: Record<PlanningResult["brief"]["objective"], {
  label: string;
  suffix: string;
}> = {
  broad_reach: { label: "Target reach", suffix: " people" },
  influential_core: { label: "Influence-weighted reach", suffix: " weighted people" },
  near_conversion: { label: "Serviceable reach", suffix: " people" },
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
          Inventory or timing constraints limited this comparison. Fine-tune any available
          package to repair constraints or shape a custom plan.
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
                    <small>Planning fit</small>
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
                  <span>{candidate.zoneIds.length} zones · {candidate.siteIds.length} sites</span>
                  <span className={headroom >= 0 ? "budget-headroom" : "budget-overrun"}>
                    {headroom >= 0
                      ? `₦${compact(headroom)} headroom`
                      : `₦${compact(Math.abs(headroom))} over budget`}
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
