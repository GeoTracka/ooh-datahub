"use client";

import { useEffect, useRef } from "react";
import { PlannerDrawerFrame } from "@/features/PlannerDrawerFrame";
import type { SurveyPlanningContextArtifact } from "@/survey/publishedContext";
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

export function PlanningContextDrawer({
  artifact,
  onClose,
}: {
  artifact: SurveyPlanningContextArtifact;
  onClose(): void;
}) {
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
          package. They do not alter its delivery estimate, plan score, or
          evidence grade.
        </p>
        <dl className="planning-context-source-summary">
          <div>
            <dt>Market</dt>
            <dd>{artifact.scopeLabel}</dd>
          </div>
          <div>
            <dt>Survey sample</dt>
            <dd>{artifact.sampleSize.toLocaleString("en-NG")} respondents</dd>
          </div>
          <div>
            <dt>Collection period</dt>
            <dd>{surveyPeriodLabel(artifact.sourcePeriod)}</dd>
          </div>
          <div>
            <dt>Use in planning</dt>
            <dd>Context only</dd>
          </div>
        </dl>
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
            Results are unweighted descriptive aggregates, not population
            estimates.
          </li>
          <li>
            Question denominators can differ because only applicable answers are
            counted.
          </li>
          <li>Small cells are omitted or suppressed before publication.</li>
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
              <dt>Published artifact digest</dt>
              <dd>
                <code>{artifact.artifactDigest}</code>
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
