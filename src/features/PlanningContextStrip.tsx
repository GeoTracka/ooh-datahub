import type {
  SurveyPlanningContextArtifact,
  SurveyPlanningContextProfile,
} from "@/survey/publishedContext";
import { selectSurveyPlanningContextProfile } from "@/survey/publishedContext";
import type { SurveyPlanningObjective } from "@/survey/contracts";
import {
  SURVEY_CONTEXT_BOUNDARY_COPY,
  surveyPeriodLabel,
} from "@/survey/display";

export function PlanningContextStrip({
  artifact,
  objective,
  onExplore,
}: {
  artifact: SurveyPlanningContextArtifact;
  objective: SurveyPlanningObjective;
  onExplore(): void;
}) {
  const profile: SurveyPlanningContextProfile =
    selectSurveyPlanningContextProfile(artifact, objective);
  return (
    <section
      className="planning-context-strip"
      aria-labelledby="planning-context-title"
      aria-describedby="planning-context-boundary-note"
      data-objective={objective}
    >
      <header className="planning-context-strip-header">
        <div>
          <span className="planning-context-kicker">
            Consumer survey · {profile.label}
          </span>
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

      <div className="planning-context-signal-grid">
        {profile.signals.map((signal) => (
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
        <span>{artifact.scopeLabel}</span>
        <span>{profile.label} objective</span>
        <span>n={artifact.sampleSize.toLocaleString("en-NG")}</span>
        <span>{surveyPeriodLabel(artifact.sourcePeriod)}</span>
        <strong>Context only</strong>
        <span className="sr-only">{SURVEY_CONTEXT_BOUNDARY_COPY}</span>
      </footer>
    </section>
  );
}
