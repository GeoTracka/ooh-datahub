"use client";

import { useEffect, useRef, useState } from "react";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { PlanningResult } from "@/contracts/domain";
import {
  RfqReviewInputSchema,
  type RfqDraft,
  type RfqWorkflowState,
} from "@/contracts/rfq";
import { PlannerDrawerFrame } from "@/features/PlannerDrawerFrame";
import { OperationStatus } from "@/features/OperationStatus";
import { RecoveryNotice } from "@/features/RecoveryNotice";
import { buildInternalDownload, generateRfq } from "@/planning/rfq";
import { PUBLIC_COPY } from "@/content/plainLanguage";

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

type RfqGenerator = (...args: Parameters<typeof generateRfq>) => RfqDraft | Promise<RfqDraft>;

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
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
  generator?: RfqGenerator;
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
  const generatingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
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
  const generating = workflow.status === "Generating";
  function change(action: () => void) {
    if (generatingRef.current) return;
    action();
    setWorkflow({ status: "Review required" });
  }
  async function generate() {
    if (generatingRef.current || !valid) return;
    generatingRef.current = true;
    setWorkflow({ status: "Generating" });
    await nextPaint();
    try {
      const output = await generator(frozenLagosBundle, plan, review);
      if (mountedRef.current) setWorkflow({ status: "Generated", output });
    } catch (error) {
      if (mountedRef.current) {
        setWorkflow({
          status: "Generation failed",
          message: error instanceof Error ? error.message : "RFQ_GENERATION_FAILED",
        });
      }
    } finally {
      generatingRef.current = false;
    }
  }
  const output: RfqDraft | null = workflow.status === "Generated" ? workflow.output : null;
  return (
    <PlannerDrawerFrame
      ariaLabel={PUBLIC_COPY.rfq.title}
      eyebrow="Supplier details"
      className="rfq-drawer"
      dialogRef={dialogRef}
      closeRef={closeRef}
      onClose={onClose}
      busy={generating}
    >
      <div className="planner-drawer-status-row">
        <strong>{PUBLIC_COPY.rfq.watermark}</strong>
        <span>{workflow.status}</span>
      </div>
      {generating && (
        <OperationStatus
          title="Generating supplier request…"
          detail="Using the reviewed package and contact details. Nothing is being sent, booked, or reserved."
        />
      )}
      {workflow.status === "Generation failed" && (
        <RecoveryNotice
          ariaLabel="Supplier request generation failure"
          title="We couldn't generate the supplier request"
          tone="error"
          technicalCode={workflow.message}
        >
          <p>Your reviewed fields are still here. Check them and retry; nothing was sent, booked, or reserved.</p>
        </RecoveryNotice>
      )}
      <div className="planner-drawer-form-grid">
        <label>Buyer name<input disabled={generating} value={buyerName} onChange={(event) => change(() => setBuyerName(event.target.value))} /></label>
        <label>Buyer email<input type="email" disabled={generating} value={buyerEmail} onChange={(event) => change(() => setBuyerEmail(event.target.value))} /></label>
        <label>Response deadline<input type="date" disabled={generating} value={responseDeadline} onChange={(event) => change(() => setResponseDeadline(event.target.value))} /></label>
        <label>Flight start<input type="date" disabled={generating} value={flightStart} onChange={(event) => change(() => setFlightStart(event.target.value))} /></label>
        <label>Flight end<input type="date" disabled={generating} value={flightEnd} onChange={(event) => change(() => setFlightEnd(event.target.value))} /></label>
      </div>
      {!datesMatchAppliedPlan && <section className="planner-drawer-notice" aria-label="Schedule revision required">
        <p>Dates changed. Update the plan with these dates before creating the supplier request.</p>
        <button
          type="button"
          disabled={generating || flightStart > flightEnd}
          onClick={() => onScheduleRevision(flightStart, flightEnd)}
        >
          Update plan with these dates
        </button>
      </section>}
      <label className="planner-choice-control">
        <input type="checkbox" disabled={generating} checked={datesConfirmed} onChange={(event) => change(() => setDatesConfirmed(event.target.checked))} />
        <span>Dates confirmed</span>
      </label>
      {supplierIds.map((supplierId) => <label key={supplierId}>
        {supplierId} note
        <textarea disabled={generating} value={supplierNotes[supplierId] ?? ""} onChange={(event) => change(() => setSupplierNotes((current) => ({ ...current, [supplierId]: event.target.value })))} />
      </label>)}
      <div className="planner-drawer-primary-row">
        <button className="primary" type="button" disabled={!valid || generating} onClick={() => void generate()}>{generating ? "Creating supplier request…" : workflow.status === "Generation failed" ? "Retry supplier request" : "Create supplier request"}</button>
      </div>
      {output?.supplierMessages.map((message) => <section className="planner-drawer-output" key={message.supplierId}>
        <h2>{message.supplierId}</h2>
        <pre>{message.body}</pre>
        <div className="planner-drawer-action-row">
          <button type="button" onClick={() => void navigator.clipboard.writeText(message.body)}>Copy {message.supplierId} request</button>
          <button type="button" onClick={() => downloadText(message.supplierId + "-supplier-request.txt", message.body)}>Download {message.supplierId} request</button>
        </div>
      </section>)}
      {output && <button type="button" onClick={() => downloadText(
        "consolidated-internal-request.json",
        buildInternalDownload(output),
      )}>Download consolidated internal request</button>}
      <p className="planner-drawer-footnote">Status: {PUBLIC_COPY.rfq.status}</p>
    </PlannerDrawerFrame>
  );
}
