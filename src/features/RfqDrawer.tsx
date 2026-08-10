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

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function downloadText(fileName: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
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
  const valid = plan.recommended.valid && datesMatchAppliedPlan &&
    RfqReviewInputSchema.safeParse(review).success;
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
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Supplier verification RFQ">
    <button ref={closeRef} type="button" onClick={onClose}>Close</button>
    <strong>DEMO — DO NOT SEND</strong>
    <p>{workflow.status}</p>
    {workflow.status === "Generation failed" && <p role="alert">{workflow.message}</p>}
    <label>Buyer name<input value={buyerName} onChange={(event) => change(() => setBuyerName(event.target.value))} /></label>
    <label>Buyer email<input type="email" value={buyerEmail} onChange={(event) => change(() => setBuyerEmail(event.target.value))} /></label>
    <label>Response deadline<input type="date" value={responseDeadline} onChange={(event) => change(() => setResponseDeadline(event.target.value))} /></label>
    <label>Flight start<input type="date" value={flightStart} onChange={(event) => change(() => setFlightStart(event.target.value))} /></label>
    <label>Flight end<input type="date" value={flightEnd} onChange={(event) => change(() => setFlightEnd(event.target.value))} /></label>
    {!datesMatchAppliedPlan && <section aria-label="Schedule revision required">
      <p>Dates changed. Recompute a dirty plan revision before generating the RFQ.</p>
      <button
        type="button"
        disabled={flightStart > flightEnd}
        onClick={() => onScheduleRevision(flightStart, flightEnd)}
      >
        Recompute plan with these dates
      </button>
    </section>}
    <label><input type="checkbox" checked={datesConfirmed} onChange={(event) => change(() => setDatesConfirmed(event.target.checked))} />Dates confirmed</label>
    {supplierIds.map((supplierId) => <label key={supplierId}>
      {supplierId} note
      <textarea value={supplierNotes[supplierId] ?? ""} onChange={(event) => change(() => setSupplierNotes((current) => ({ ...current, [supplierId]: event.target.value })))} />
    </label>)}
    <button type="button" disabled={!valid || workflow.status === "Generating"} onClick={() => void generate()}>Generate RFQ</button>
    {output?.supplierMessages.map((message) => <section key={message.supplierId}>
      <h2>{message.supplierId}</h2>
      <pre>{message.body}</pre>
      <button type="button" onClick={() => void navigator.clipboard.writeText(message.body)}>Copy {message.supplierId} request</button>
      <button type="button" onClick={() => downloadText(message.supplierId + "-rfq.txt", message.body)}>Download {message.supplierId} request</button>
    </section>)}
    {output && <button type="button" onClick={() => downloadText(
      "consolidated-internal-request.json",
      buildInternalDownload(output),
    )}>Download consolidated internal request</button>}
    <p>Status: draft, unbooked, unsent</p>
  </div>;
}
