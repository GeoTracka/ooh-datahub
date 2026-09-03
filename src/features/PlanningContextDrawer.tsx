"use client";

import { useEffect, useRef, useState } from "react";
import { PlannerDrawerFrame } from "@/features/PlannerDrawerFrame";
import type {
  ResolvedSurveyPlanningContext,
  SurveyAudienceLensChoice,
} from "@/survey/lagosPlanningContext";
import type { SurveySegmentDimension } from "@/survey/segmentCatalogue";
import {
  SURVEY_CONTEXT_BOUNDARY_COPY,
  surveyPeriodLabel,
} from "@/survey/display";

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const AUTOMATIC_LENS_VALUE = "__automatic__";
const CITY_LENS_VALUE = "__all_lagos__";

const objectiveLabels: Record<
  ResolvedSurveyPlanningContext["artifact"]["objective"],
  string
> = {
  broad_reach: "Broad reach",
  influential_core: "Priority audience",
  near_conversion: "Likely customers",
};

const resolutionLabels: Record<
  ResolvedSurveyPlanningContext["resolution"]["mode"],
  string
> = {
  matched: "Exact published match",
  matched_after_suppression: "Next available matched segment",
  fallback_suppressed: "Broader city fallback",
  fallback_no_match: "No supported segment detected",
};

const dimensionLabels: Record<SurveySegmentDimension, string> = {
  ageBand: "Age",
  occupation: "Occupation",
  incomeBand: "Monthly income",
  transportMode: "Primary transport",
  commutePattern: "Mobility pattern",
};

function selectionStatus(context: ResolvedSurveyPlanningContext): string {
  if (context.selection.mode === "automatic") return "Automatic from brief";
  return context.selection.manualAction === "confirmed_automatic"
    ? "User confirmed"
    : "Manual override";
}

function currentChoiceValue(context: ResolvedSurveyPlanningContext): string {
  if (context.selection.mode === "automatic") return AUTOMATIC_LENS_VALUE;
  return context.selection.selectedProfileId ?? CITY_LENS_VALUE;
}

function choiceFromValue(value: string): SurveyAudienceLensChoice {
  if (value === AUTOMATIC_LENS_VALUE) return { mode: "automatic" };
  if (value === CITY_LENS_VALUE) return { mode: "manual", profileId: null };
  return { mode: "manual", profileId: value };
}

export function PlanningContextDrawer({
  context,
  onAudienceLensChange,
  onClose,
}: {
  context: ResolvedSurveyPlanningContext;
  onAudienceLensChange(choice: SurveyAudienceLensChoice): void;
  onClose(): void;
}) {
  const { artifact, resolution, selection } = context;
  const currentValue = currentChoiceValue(context);
  const [draftLens, setDraftLens] = useState<{
    baseValue: string;
    value: string;
  } | null>(null);
  const draftLensValue =
    draftLens?.baseValue === currentValue ? draftLens.value : currentValue;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          focusableSelector,
        ) ?? []),
      ].filter(
        (element) => !element.hidden && element.getClientRects().length > 0,
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  const cityOption = context.audienceOptions.find(
    ({ profileId }) => profileId === null,
  );
  const profileOptions = context.audienceOptions.filter(
    ({ profileId }) => profileId !== null,
  );
  return (
    <PlannerDrawerFrame
      ariaLabel="Consumer survey context"
      eyebrow="Planning context"
      className="planning-context-drawer"
      dialogRef={dialogRef}
      closeRef={closeRef}
      onClose={onClose}
    >
      <section className="planning-context-drawer-intro">
        <span className="planning-context-kicker">Lagos consumer research</span>
        <h1>What people reported about outdoor advertising</h1>
        <p>
          These findings add local consumer perspective beside the selected
          package. They do not alter its delivery estimate, plan score, audience
          universe, or evidence grade.
        </p>
        <dl className="planning-context-source-summary">
          <div>
            <dt>Market</dt>
            <dd>{artifact.scope.city ?? "Lagos"}</dd>
          </div>
          <div>
            <dt>Audience lens</dt>
            <dd>{selection.selectedLabel}</dd>
          </div>
          <div>
            <dt>Lens selection</dt>
            <dd>{selectionStatus(context)}</dd>
          </div>
          <div>
            <dt>Campaign objective</dt>
            <dd>{objectiveLabels[artifact.objective]}</dd>
          </div>
          <div>
            <dt>Survey sample</dt>
            <dd>{artifact.sampleSize.toLocaleString("en-NG")} respondents</dd>
          </div>
          <div>
            <dt>Collection period</dt>
            <dd>{surveyPeriodLabel(artifact.sourcePeriod)}</dd>
          </div>
        </dl>
      </section>

      <section
        className="planning-context-lens-review"
        aria-labelledby="planning-context-lens-review-title"
      >
        <div className="planning-context-drawer-section-heading">
          <span>Review audience lens</span>
          <h2 id="planning-context-lens-review-title">
            Keep the automatic match or choose another published segment
          </h2>
        </div>
        <p>
          The automatic suggestion is{" "}
          <strong>{resolution.selectedLabel}</strong> (n=
          {resolution.selectedSampleSize.toLocaleString("en-NG")}). Changing
          this lens changes only the survey context shown here.
        </p>
        <div className="planning-context-lens-review-controls">
          <label htmlFor="survey-audience-lens-select">
            Audience lens
            <select
              id="survey-audience-lens-select"
              value={draftLensValue}
              onChange={(event) =>
                setDraftLens({
                  baseValue: currentValue,
                  value: event.target.value,
                })
              }
              aria-describedby="survey-audience-lens-help"
            >
              <option value={AUTOMATIC_LENS_VALUE}>
                Automatic — {resolution.selectedLabel} (n=
                {resolution.selectedSampleSize})
              </option>
              {cityOption && (
                <option value={CITY_LENS_VALUE}>
                  {cityOption.label} (n={cityOption.sampleSize})
                </option>
              )}
              {(Object.keys(dimensionLabels) as SurveySegmentDimension[]).map(
                (dimension) => {
                  const options = profileOptions.filter(
                    (option) => option.dimension === dimension,
                  );
                  return options.length > 0 ? (
                    <optgroup
                      key={dimension}
                      label={dimensionLabels[dimension]}
                    >
                      {options.map((option) => (
                        <option
                          key={option.profileId}
                          value={option.profileId!}
                        >
                          {option.label} (n={option.sampleSize})
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                },
              )}
            </select>
          </label>
          <button
            type="button"
            className="planning-context-lens-apply"
            disabled={draftLensValue === currentValue}
            onClick={() =>
              onAudienceLensChange(choiceFromValue(draftLensValue))
            }
          >
            Apply lens
          </button>
        </div>
        <p
          id="survey-audience-lens-help"
          className="planning-context-lens-help"
        >
          Only published Lagos segments meeting the minimum sample of n≥
          {context.minimumSampleSize} are available.
        </p>
        <div className="planning-context-lens-actions">
          {selection.mode === "automatic" ? (
            <button
              type="button"
              onClick={() =>
                onAudienceLensChange({
                  mode: "manual",
                  profileId: resolution.selectedProfileId,
                })
              }
            >
              Confirm automatic lens
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAudienceLensChange({ mode: "automatic" })}
            >
              Use automatic match
            </button>
          )}
          <span role="status" aria-live="polite">
            Current: {selectionStatus(context)} · {selection.selectedLabel}
          </span>
        </div>
      </section>

      <section
        className="planning-context-resolution"
        aria-labelledby="planning-context-resolution-title"
      >
        <div className="planning-context-drawer-section-heading">
          <span>Automatic audience resolution</span>
          <h2 id="planning-context-resolution-title">
            How the brief suggested a lens
          </h2>
        </div>
        <p>{resolution.explanation}</p>
        {selection.mode === "manual" && (
          <p className="planning-context-selection-explanation">
            {selection.explanation}
          </p>
        )}
        <dl>
          <div>
            <dt>Resolution result</dt>
            <dd>{resolutionLabels[resolution.mode]}</dd>
          </div>
          <div>
            <dt>Matched brief terms</dt>
            <dd>
              {resolution.matchedTerms.length > 0
                ? resolution.matchedTerms.map((term) => `“${term}”`).join(", ")
                : "No supported terms detected"}
            </dd>
          </div>
          <div>
            <dt>Requested predicate</dt>
            <dd>
              {resolution.requestedPredicateLabel ?? "No explicit predicate"}
            </dd>
          </div>
          <div>
            <dt>Automatic published predicate</dt>
            <dd>
              {resolution.selectedPredicateLabel ?? "All Lagos respondents"}
            </dd>
          </div>
          <div>
            <dt>Automatic sample</dt>
            <dd>
              n={resolution.selectedSampleSize} · policy n≥
              {context.minimumSampleSize}
            </dd>
          </div>
          <div>
            <dt>Active published predicate</dt>
            <dd>
              {selection.selectedPredicateLabel ?? "All Lagos respondents"}
            </dd>
          </div>
        </dl>
        {resolution.unavailablePredicateLabels.length > 0 && (
          <details>
            <summary>Predicates unavailable after suppression</summary>
            <ul>
              {resolution.unavailablePredicateLabels.map((predicate) => (
                <li key={predicate}>{predicate}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="planning-context-findings-title">
        <div className="planning-context-drawer-section-heading">
          <span>Selected signals</span>
          <h2 id="planning-context-findings-title">Independent findings</h2>
        </div>
        <div className="planning-context-finding-list">
          {artifact.signals.map((signal) => (
            <article key={signal.id}>
              <header>
                <span>{signal.label}</span>
                <strong>{signal.valueText}</strong>
              </header>
              <h3>{signal.metricLabel}</h3>
              <p>{signal.evidenceSentence}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="planning-context-boundary"
        aria-labelledby="planning-context-boundary-title"
      >
        <span>Evidence boundary</span>
        <h2 id="planning-context-boundary-title">
          Consumer context, not delivery measurement
        </h2>
        <p>{SURVEY_CONTEXT_BOUNDARY_COPY}</p>
      </section>

      <section
        className="planning-context-method"
        aria-labelledby="planning-context-method-title"
      >
        <div className="planning-context-drawer-section-heading">
          <span>Method</span>
          <h2 id="planning-context-method-title">How to read these results</h2>
        </div>
        <ul>
          <li>
            The solution owner supplied and approved the final cleaned workbook.
          </li>
          <li>
            Deterministic rules inspect target-audience and product-description
            terms, then suggest the first matched segment that clears n≥
            {context.minimumSampleSize}.
          </li>
          <li>
            A user may confirm or override that lens using only published,
            minimum-cell-safe segments. A manual choice is display context only.
          </li>
          <li>
            The audience lens and campaign objective select which survey facts
            are shown; they do not change package calculations, ranking, target
            shares, or delivery.
          </li>
          <li>
            Results are unweighted descriptive aggregates, not population
            estimates.
          </li>
          <li>
            Question denominators can differ because only applicable answers are
            counted.
          </li>
        </ul>
        <details>
          <summary>Technical source details</summary>
          <dl>
            <div>
              <dt>Source ID</dt>
              <dd>
                <code>{artifact.sourceId}</code>
              </dd>
            </div>
            <div>
              <dt>Source snapshot digest</dt>
              <dd>
                <code>{artifact.sourceSnapshotDigest}</code>
              </dd>
            </div>
            <div>
              <dt>Segment catalogue digest</dt>
              <dd>
                <code>{context.catalogueDigest}</code>
              </dd>
            </div>
            <div>
              <dt>Published artifact digest</dt>
              <dd>
                <code>{artifact.artifactDigest}</code>
              </dd>
            </div>
            <div>
              <dt>Automatic resolution policy</dt>
              <dd>
                <code>{resolution.policy}</code>
              </dd>
            </div>
            <div>
              <dt>Lens selection mode</dt>
              <dd>
                <code>{selection.mode}</code>
              </dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>
                <code>{artifact.schemaVersion}</code>
              </dd>
            </div>
            <div>
              <dt>Claim boundary</dt>
              <dd>
                <code>{artifact.claimBoundary}</code>
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </PlannerDrawerFrame>
  );
}
