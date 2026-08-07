import type { selectZoneCards } from "@/application/plannerSelectors";

type ZoneCard = ReturnType<typeof selectZoneCards>[number];

export function RecommendationCards({
  cards,
  objective,
  selectedZoneId,
  onZone,
  onSite,
}: {
  cards: ZoneCard[];
  objective: "broad_reach" | "influential_core" | "near_conversion";
  selectedZoneId: string | null;
  onZone(zoneId: string): void;
  onSite(siteId: string): void;
}) {
  if (cards.length > 3) throw new Error("MORE_THAN_THREE_ZONE_CARDS");
  return (
    <ol className="zone-cards" aria-label="Recommended zones">
      {cards.map((card) => {
        const delivery = objective === "influential_core"
          ? { label: "Marginal influence-weighted reach", value: card.marginalInfluenceMass, suffix: " weighted people" }
          : objective === "near_conversion"
            ? { label: "Marginal serviceable reach", value: card.marginalServiceableReach, suffix: " people" }
            : { label: "Marginal target reach", value: card.marginalReach, suffix: " people" };
        return (
          <li key={card.zoneId} data-testid="zone-card">
            <button type="button" onClick={() => onZone(card.zoneId)}>
              <span>#{card.rank} · {card.role}</span>
              <strong>{card.label}</strong>
              <span>Activity Potential {card.activityPotential?.toFixed(0) ?? "Unavailable"}/100</span>
              <span>{delivery.label}: {delivery.value?.toLocaleString() ?? "Unavailable"}{delivery.value === null ? "" : delivery.suffix}</span>
            </button>
            {selectedZoneId === card.zoneId && <div aria-label={card.label + " sites"}>
              {card.sites.map((site) => (
                <button key={site.id} type="button" onClick={() => onSite(site.id)}>
                  {site.label}
                </button>
              ))}
            </div>}
          </li>
        );
      })}
    </ol>
  );
}
