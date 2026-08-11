import type { ReactNode, RefObject } from "react";

export function PlannerDrawerFrame({
  ariaLabel,
  eyebrow,
  className,
  dialogRef,
  closeRef,
  onClose,
  children,
  busy = false,
}: {
  ariaLabel: string;
  eyebrow: string;
  className?: string;
  dialogRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose(): void;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <div
      ref={dialogRef}
      className={`planner-drawer${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <header className="planner-drawer-header">
        <span className="planner-drawer-eyebrow">{eyebrow}</span>
        <button
          ref={closeRef}
          className="planner-drawer-close"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>
      <div className="planner-drawer-body" aria-busy={busy || undefined}>{children}</div>
    </div>
  );
}
