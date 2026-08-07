import type { selectZoneCards } from "@/application/plannerSelectors";

type ZoneCard = ReturnType<typeof selectZoneCards>[number];

function deliveryFor(
  card: ZoneCard,
  objective: "broad_reach" | "influential_core" | "near_conversion",
) {
  if (objective === "influential_core") {
    return {
      label: "Influence-weighted reach",
      value: card.marginalInfluenceMass,
      suffix: " weighted people",
    };
  }
  if (objective === "near_conversion") {
    return {
      label: "Serviceable reach",
      value: card.marginalServiceableReach,
      suffix: " people",
    };
  }
  return {
    label: "Target reach",
    value: card.marginalReach,
    suffix: " people",
  };
}

export function RecommendationCarousel({
  cards,
  objective,
  selectedZoneId,
  onSelect,
  onExplain,
}: {
  cards: ZoneCard[];
  objective: "broad_reach" | "influential_core" | "near_conversion";
  selectedZoneId: string | null;
  onSelect(zoneId: string): void;
  onExplain(zoneId: string): void;
}) {
  return (
    <div className="recommendation-carousel" aria-label="Recommended package zones">
      {cards.map((card) => {
        const delivery = deliveryFor(card, objective);
        const selected = card.zoneId === selectedZoneId;
        return (
          <article
            key={card.zoneId}
            className={selected ? "recommendation-slide selected" : "recommendation-slide"}
            data-testid="zone-card"
          >
            <button
              type="button"
              className="recommendation-slide-main"
              aria-pressed={selected}
              onClick={() => onSelect(card.zoneId)}
            >
              <span className="recommendation-rank">
                #{card.rank} · {card.rank === 1 ? "Primary" : card.rank === 2 ? "Booster" : "Cover"}
              </span>
              <strong>{card.label}</strong>
              <span>{delivery.label}</span>
              <b>
                {delivery.value === null
                  ? "Unavailable"
                  : `${Math.round(delivery.value).toLocaleString("en")}${delivery.suffix}`}
              </b>
              <span>Activity Potential {card.activityPotential?.toFixed(0) ?? "Unavailable"}/100</span>
            </button>
            {selected && (
              <button
                type="button"
                className="explorer-link-button recommendation-story"
                onClick={() => onExplain(card.zoneId)}
              >
                View delivery story
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
