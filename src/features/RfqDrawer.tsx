"use client";

import { useEffect, useRef, useState } from "react";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { PlanningResult } from "@/contracts/domain";
import {
  RfqReviewInputSchema,
  type RfqDraft,
  type RfqWorkflowState,
} from "@/contracts/rfq";
import { buildInternalDownload, generateRfq } from "@/planning/rfq";

export function downloadText(fileName: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function generationBlocker({
  planValid,
  datesMatchAppliedPlan,
  buyerName,
  buyerEmail,
  responseDeadline,
  datesConfirmed,
  schemaValid,
}: {
  planValid: boolean;
  datesMatchAppliedPlan: boolean;
  buyerName: string;
  buyerEmail: string;
  responseDeadline: string;
  datesConfirmed: boolean;
  schemaValid: boolean;
}): string | null {
  if (!planValid) return "Repair the package constraints before generating a supplier request.";
  if (!datesMatchAppliedPlan) return "Recompute the plan after changing flight dates.";
  if (buyerName.trim().length < 2) return "Add the buyer name.";
  if (!buyerEmail.trim()) return "Add a valid buyer email.";
  if (!responseDeadline) return "Choose a supplier response deadline before the flight starts.";
  if (!datesConfirmed) return "Confirm the applied flight dates.";
  if (!schemaValid) return "Review the buyer, deadline and schedule fields before generating.";
  return null;
}

export function RfqDrawer({
  plan,
  onClose,
  onScheduleRevision,
  generator = generateRfq,
}: {
  plan: PlanningResult;
  onClose(): void;
  onScheduleRevision(flightStart: string, flightEnd: string): void;
  generator?: typeof generateRfq;
}) {
  const supplierIds = [...new Set(plan.recommended.siteIds.flatMap((siteId) => {
    const site = frozenLagosBundle.sites.find((s) => s.id === siteId);
    return site ? [site.supplierId] : [];
  }))].sort();
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [flightStart, setFlightStart] = useState(plan.brief.flightStart);
  const [flightEnd, setFlightEnd] = useState(plan.brief.flightEnd);
  const [datesConfirmed, setDatesConfirmed] = useState(false);
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>({});
  const [workflow, setWorkflow] = useState<RfqWorkflowState>({ status: "Review required" });
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
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  const review = {
    buyerContact: { name: buyerName, email: buyerEmail },
    responseDeadline,
    flightStart,
    flightEnd,
    datesConfirmed,
    supplierNotes,
  };
  const datesMatchAppliedPlan = flightStart === plan.brief.flightStart &&
    flightEnd === plan.brief.flightEnd;
  const reviewResult = RfqReviewInputSchema.safeParse(review);
  const valid = plan.recommended.valid && datesMatchAppliedPlan && reviewResult.success;
  const blocker = generationBlocker({
    planValid: plan.recommended.valid,
    datesMatchAppliedPlan,
    buyerName,
    buyerEmail,
    responseDeadline,
    datesConfirmed,
    schemaValid: reviewResult.success,
  });

  function change(action: () => void) {
    action();
    setWorkflow({ status: "Review required" });
  }

  async function generate() {
    setWorkflow({ status: "Generating" });
    await Promise.resolve();
    try {
      setWorkflow({ status: "Generated", output: generator(frozenLagosBundle, plan, review) });
    } catch (error) {
      setWorkflow({
        status: "Generation failed",
        message: error instanceof Error ? error.message : "RFQ_GENERATION_FAILED",
      });
    }
  }

  const output: RfqDraft | null = workflow.status === "Generated" ? workflow.output : null;
  return (
    <aside className="rfq-drawer" role="dialog" aria-modal="true" aria-label="Supplier verification RFQ">
      <header className="rfq-drawer-header">
        <button ref={closeRef} type="button" onClick={onClose}>Close</button>
        <div>
          <span className="rfq-watermark">DEMO — DO NOT SEND</span>
          <h1>Supplier verification RFQ</h1>
          <p>Review the applied package before generating isolated requests for each supplier.</p>
        </div>
      </header>

      <section className="rfq-summary" aria-label="RFQ package summary">
        <div><span>Package</span><strong>{plan.recommended.siteIds.length} sites</strong></div>
        <div><span>Flight</span><strong>{plan.brief.flightStart} → {plan.brief.flightEnd}</strong></div>
        <div><span>Suppliers</span><strong>{supplierIds.length}</strong></div>
        <div><span>Status</span><strong>{workflow.status}</strong></div>
      </section>

      {workflow.status === "Generation failed" && (
        <p role="alert">RFQ generation failed. <code>{workflow.message}</code></p>
      )}

      <section className="rfq-review-section" aria-labelledby="rfq-buyer-heading">
        <h2 id="rfq-buyer-heading">Buyer</h2>
        <label>Buyer name<input value={buyerName} onChange={(event) => change(() => setBuyerName(event.target.value))} /></label>
        <label>Buyer email<input type="email" value={buyerEmail} onChange={(event) => change(() => setBuyerEmail(event.target.value))} /></label>
        <label>Response deadline<input type="date" value={responseDeadline} onChange={(event) => change(() => setResponseDeadline(event.target.value))} /></label>
      </section>

      <section className="rfq-review-section" aria-labelledby="rfq-schedule-heading">
        <h2 id="rfq-schedule-heading">Schedule</h2>
        <div className="rfq-field-pair">
          <label>Flight start<input type="date" value={flightStart} onChange={(event) => change(() => setFlightStart(event.target.value))} /></label>
          <label>Flight end<input type="date" value={flightEnd} onChange={(event) => change(() => setFlightEnd(event.target.value))} /></label>
        </div>
        {!datesMatchAppliedPlan && (
          <section className="rfq-revision-required" aria-label="Schedule revision required">
            <strong>Schedule changed</strong>
            <p>Delivery must be recomputed before this RFQ can represent the applied plan.</p>
            <button
              type="button"
              disabled={flightStart > flightEnd}
              onClick={() => onScheduleRevision(flightStart, flightEnd)}
            >
              Recompute plan with these dates
            </button>
          </section>
        )}
        <label className="rfq-confirmation">
          <input type="checkbox" checked={datesConfirmed} onChange={(event) => change(() => setDatesConfirmed(event.target.checked))} />
          Dates confirmed
        </label>
      </section>

      <section className="rfq-review-section" aria-labelledby="rfq-suppliers-heading">
        <h2 id="rfq-suppliers-heading">Supplier notes</h2>
        <p>Optional notes are isolated to the named supplier request.</p>
        {supplierIds.map((supplierId) => (
          <label key={supplierId}>
            Supplier · {supplierId}
            <textarea
              aria-label={`${supplierId} note`}
              placeholder="Optional supplier-specific note"
              value={supplierNotes[supplierId] ?? ""}
              onChange={(event) => change(() => setSupplierNotes((current) => ({
                ...current,
                [supplierId]: event.target.value,
              })))}
            />
          </label>
        ))}
      </section>

      <section className="rfq-generation" aria-label="Generate supplier requests">
        {blocker && <p role="status">Before generating: {blocker}</p>}
        <button
          type="button"
          className="primary"
          disabled={!valid || workflow.status === "Generating"}
          onClick={() => void generate()}
        >
          {workflow.status === "Generating" ? "Generating…" : "Generate RFQ"}
        </button>
      </section>

      {output && (
        <section className="rfq-output" aria-label="Generated supplier requests">
          <header>
            <h2>Generated requests</h2>
            <p>Review each supplier-isolated request. Nothing is sent or booked by this demo.</p>
          </header>
          {output.supplierMessages.map((message) => (
            <article className="rfq-message-card" key={message.supplierId}>
              <header>
                <span>Supplier · {message.supplierId}</span>
                <strong>{message.subject}</strong>
                <small>{message.lines.length} line{message.lines.length === 1 ? "" : "s"} · {message.status}</small>
              </header>
              <div className="rfq-message-body">{message.body}</div>
              <div className="rfq-message-actions">
                <button type="button" onClick={() => void navigator.clipboard.writeText(message.body)}>Copy {message.supplierId} request</button>
                <button type="button" onClick={() => downloadText(message.supplierId + "-rfq.txt", message.body)}>Download {message.supplierId} request</button>
              </div>
              <details>
                <summary>Plain-text preview</summary>
                <pre>{message.body}</pre>
              </details>
            </article>
          ))}
          <button type="button" onClick={() => downloadText(
            "consolidated-internal-request.json",
            buildInternalDownload(output),
          )}>Download consolidated internal request</button>
        </section>
      )}

      <footer className="rfq-status-footer">Status: draft, unbooked, unsent</footer>
    </aside>
  );
}
