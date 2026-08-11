export function OperationStatus({
  title,
  detail,
  label,
}: {
  title: string;
  detail: string;
  label?: string;
}) {
  return (
    <div
      className="operation-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label ?? title}
    >
      <span className="operation-status-indicator" aria-hidden="true" />
      <span className="operation-status-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </div>
  );
}
