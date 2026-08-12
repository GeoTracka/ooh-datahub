"use client";

import { useEffect, useRef } from "react";
import type { selectZoneCards } from "@/application/plannerSelectors";
import { PUBLIC_COPY } from "@/content/plainLanguage";

type ZoneCard = ReturnType<typeof selectZoneCards>[number];

function deliveryFor(
  card: ZoneCard,
  objective: "broad_reach" | "influential_core" | "near_conversion",
) {
  if (objective === "influential_core") {
    return {
      label: PUBLIC_COPY.metrics.additionalPriorityReach,
      value: card.marginalInfluenceMass,
      suffix: " people",
    };
  }
  if (objective === "near_conversion") {
    return {
      label: PUBLIC_COPY.metrics.additionalLikelyCustomerReach,
      value: card.marginalServiceableReach,
      suffix: " people",
    };
  }
  return {
    label: PUBLIC_COPY.metrics.additionalReach,
    value: card.marginalReach,
    suffix: " people",
  };
}

export function RecommendationCarousel({
  cards,
  objective,
  evidenceLabel,
  selectedZoneId,
  onSelect,
  onExplain,
}: {
  cards: ZoneCard[];
  objective: "broad_reach" | "influential_core" | "near_conversion";
  evidenceLabel: string;
  selectedZoneId: string | null;
  onSelect(zoneId: string | null): void;
  onExplain(zoneId: string): void;
}) {
  const selectedCardRef = useRef<HTMLElement | null>(null);
  const previousSelectedZoneId = useRef(selectedZoneId);

  useEffect(() => {
    if (previousSelectedZoneId.current === selectedZoneId) return;
    previousSelectedZoneId.current = selectedZoneId;
    if (!selectedZoneId || !selectedCardRef.current) return;
    const frame = requestAnimationFrame(() => {
      const selectedCard = selectedCardRef.current;
      if (typeof selectedCard?.scrollIntoView === "function") {
        selectedCard.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedZoneId]);

  return (
    <div className="recommendation-carousel" aria-label="Selected package areas">
      {cards.map((card) => {
        const delivery = deliveryFor(card, objective);
        const selected = card.zoneId === selectedZoneId;
        return (
          <article
            key={card.zoneId}
            ref={selected ? selectedCardRef : undefined}
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
              <span className="recommendation-role">{card.role}</span>
              <span>{delivery.label}</span>
              <b>
                {delivery.value === null
                  ? "Unavailable"
                  : `${Math.round(delivery.value).toLocaleString("en")}${delivery.suffix}`}
              </b>
              <span>{PUBLIC_COPY.metrics.areaActivity} {card.activityPotential?.toFixed(0) ?? "Unavailable"}/100</span>
              <span className="recommendation-evidence">{evidenceLabel}</span>
            </button>
            {selected && (
              <div className="recommendation-selected-detail">
                <p>
                  {card.role}. The figure above shows the additional audience this area
                  brings to the package, not the area&apos;s total audience on its own.
                </p>
                <div className="recommendation-focus-actions">
                  <button
                    type="button"
                    className="explorer-link-button recommendation-story"
                    onClick={() => onExplain(card.zoneId)}
                  >
                    See how this was estimated
                  </button>
                  <button
                    type="button"
                    className="explorer-link-button"
                    onClick={() => onSelect(null)}
                  >
                    Show all areas
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
