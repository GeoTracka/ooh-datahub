import type { ReactNode } from "react";

export function StepCard({
  step,
  total,
  title,
  eyebrow,
  children,
  onBack,
  primaryAction,
}: {
  step: number;
  total: number;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onBack?: () => void;
  primaryAction?: {
    label: string;
    onClick(): void;
    disabled?: boolean;
  };
}) {
  return (
    <section
      className="explorer-step-card"
      role="region"
      aria-label={`Step ${step} of ${total}: ${title}`}
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === "Escape" && onBack) onBack();
      }}
    >
      <header className="explorer-step-header">
        <div>
          <span className="explorer-eyebrow">{eyebrow ?? `Step ${step} of ${total}`}</span>
          <h1>{title}</h1>
        </div>
        <div
          className="explorer-progress"
          role="progressbar"
          aria-label="Campaign planning progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
        >
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={index < step ? "complete" : undefined}
              aria-hidden="true"
            />
          ))}
        </div>
      </header>
      <div className="explorer-step-content">{children}</div>
      {(onBack || primaryAction) && (
        <footer className="explorer-step-actions">
          {onBack && (
            <button type="button" className="explorer-link-button" onClick={onBack}>
              Back
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              className="primary explorer-primary-action"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
