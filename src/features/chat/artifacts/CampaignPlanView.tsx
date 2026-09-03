"use client";

import { useState } from "react";
import { Check, ChevronRight, SlidersHorizontal } from "lucide-react";

import type { PlanWorkspaceArtifact } from "@/features/chat/contracts";

function money(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

export function CampaignPlanView({
  artifact,
}: {
  artifact: PlanWorkspaceArtifact;
}) {
  const [selected, setSelected] = useState<string | null>(artifact.payload.selectedOptionId);
  const [fineTune, setFineTune] = useState(false);
  return (
    <article className="ai-plan-document">
      <header className="ai-plan-heading">
        <div>
          <span className="ai-eyebrow">Campaign plan · Revision {artifact.revision}</span>
          <h2>{artifact.payload.brief.productName}</h2>
          <p>{artifact.payload.brief.targetAudience}</p>
        </div>
        <div className="ai-status-stack" aria-label="Plan status">
          <span>Draft, not booked</span>
          <small>Availability unconfirmed</small>
        </div>
      </header>

      <section aria-labelledby="approaches-title">
        <div className="ai-section-heading">
          <div>
            <span className="ai-eyebrow">Three ways forward</span>
            <h3 id="approaches-title">Choose only when you’re ready</h3>
          </div>
          <button className="ai-secondary-button" onClick={() => setFineTune((value) => !value)}>
            <SlidersHorizontal size={16} /> Fine-tune plan
          </button>
        </div>
        <div className="ai-option-grid" role="radiogroup" aria-label="Planning approaches">
          {artifact.payload.options.map((option) => (
            <label className={`ai-option-card ${selected === option.id ? "is-selected" : ""}`} key={option.id}>
              <div className="ai-option-topline">
                <span>{option.title}</span>
                <input
                  type="radio"
                  name="plan-option"
                  aria-label={option.title}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                />
              </div>
              <strong>{money(option.candidate.costNgn)}</strong>
              <p>{option.tradeoffs[0]}</p>
              <dl>
                <div><dt>Locations</dt><dd>{option.candidate.siteIds.length}</dd></div>
                <div><dt>Areas</dt><dd>{option.candidate.zoneIds.length}</dd></div>
                <div><dt>Brief match</dt><dd>{option.candidate.planningFit ?? "—"}/100</dd></div>
              </dl>
              <span className="ai-compare-link">Compare details <ChevronRight size={14} /></span>
            </label>
          ))}
        </div>
      </section>

      {fineTune ? (
        <section className="ai-fine-tune" aria-label="Fine-tune plan">
          <div><span className="ai-eyebrow">Fine-tune</span><h3>Adjust without starting over</h3></div>
          <label>Budget (NGN)<input defaultValue={artifact.payload.brief.budgetNgn} inputMode="numeric" /></label>
          <label>Time of day<select defaultValue={artifact.payload.brief.daypart}><option value="all_day">All day</option><option value="am">Morning</option><option value="pm">Afternoon</option><option value="evening">Evening</option></select></label>
          <button className="ai-primary-button" type="button">Apply in chat</button>
        </section>
      ) : null}

      <section className="ai-plan-notes">
        <div><h3>What this plan assumes</h3>{artifact.payload.assumptions.map((text) => <p key={text}><Check size={15} />{text}</p>)}</div>
        <div><h3>Important limits</h3>{artifact.payload.limitations.map((text) => <p key={text}>{text}</p>)}</div>
      </section>
    </article>
  );
}
