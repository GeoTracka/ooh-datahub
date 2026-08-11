import type { ReactNode } from "react";

export function RecoveryNotice({
  title,
  children,
  technicalCode,
  tone = "warning",
  actions,
  ariaLabel,
}: {
  title: string;
  children: ReactNode;
  technicalCode?: string | null;
  tone?: "warning" | "error";
  actions?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section
      className={`recovery-notice recovery-notice-${tone}`}
      role="alert"
      aria-label={ariaLabel}
    >
      <div className="recovery-notice-main">
        <strong>{title}</strong>
        <div className="recovery-notice-copy">{children}</div>
        {actions && <div className="recovery-notice-actions">{actions}</div>}
      </div>
      {technicalCode && (
        <details className="recovery-notice-detail">
          <summary>Technical detail</summary>
          <code>{technicalCode}</code>
        </details>
      )}
    </section>
  );
}
