import type { ResolvedSurveyPlanningContext } from "@/survey/lagosPlanningContext";
import {
  SURVEY_CONTEXT_BOUNDARY_COPY,
  surveyPeriodLabel,
} from "@/survey/display";

function resolutionStatus(
  mode: ResolvedSurveyPlanningContext["resolution"]["mode"],
): string {
  if (mode === "matched") return "Matched from campaign brief";
  if (mode === "matched_after_suppression") {
    return "Next available matched segment";
  }
  if (mode === "fallback_suppressed") return "Broader sample used";
  return "City sample used";
}

export function PlanningContextStrip({
  context,
  onExplore,
}: {
  context: ResolvedSurveyPlanningContext;
  onExplore(): void;
}) {
  const { artifact, resolution } = context;
  return (
    <section
      className="planning-context-strip"
      aria-labelledby="planning-context-title"
      aria-describedby="planning-context-boundary-note"
    >
      <header className="planning-context-strip-header">
        <div>
          <span className="planning-context-kicker">Consumer survey</span>
          <h2 id="planning-context-title">Planning context</h2>
        </div>
        <button
          type="button"
          className="planning-context-explore"
          aria-haspopup="dialog"
          onClick={onExplore}
        >
          Explore survey context
        </button>
      </header>

      <div
        className="planning-context-audience-lens"
        role="group"
        aria-label="Survey audience lens"
      >
        <div>
          <span>Audience lens</span>
          <strong>{resolution.selectedLabel}</strong>
        </div>
        <small>{resolutionStatus(resolution.mode)}</small>
        {resolution.matchedTerms.length > 0 && (
          <p>
            Matched brief terms:{" "}
            {resolution.matchedTerms.map((term) => `“${term}”`).join(", ")}.
          </p>
        )}
      </div>

      <div className="planning-context-signal-grid">
        {artifact.signals.map((signal) => (
          <article key={signal.id} data-testid="planning-context-signal">
            <span>{signal.label}</span>
            <strong>{signal.valueText}</strong>
            <p>{signal.metricLabel}</p>
          </article>
        ))}
      </div>

      <footer
        className="planning-context-meta"
        id="planning-context-boundary-note"
      >
        <span>{artifact.scope.city ?? artifact.scopeLabel}</span>
        <span>n={artifact.sampleSize.toLocaleString("en-NG")}</span>
        <span>{surveyPeriodLabel(artifact.sourcePeriod)}</span>
        <strong>Context only</strong>
        <span className="sr-only">
          {resolution.explanation} {SURVEY_CONTEXT_BOUNDARY_COPY}
        </span>
      </footer>
    </section>
  );
}
