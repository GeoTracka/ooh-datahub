export function ActionDock({
  canReviewRfq,
  onReviewRfq,
  onUpload,
  onFineTune,
}: {
  canReviewRfq: boolean;
  onReviewRfq(): void;
  onUpload(): void;
  onFineTune(): void;
}) {
  const actions = [
    {
      title: "Review RFQ",
      description: canReviewRfq
        ? "Generate the supplier verification request from the applied package."
        : "Repair package constraints before generating a supplier verification request.",
      action: onReviewRfq,
      disabled: !canReviewRfq,
    },
    {
      title: "Upload customer inventory",
      description: "Add customer-owned sites as context without upgrading their evidence state.",
      action: onUpload,
      disabled: false,
    },
    {
      title: "Fine-tune package",
      description: "Include, swap, replace or remove faces and inspect the exact trade-off.",
      action: onFineTune,
      disabled: false,
    },
  ];

  return (
    <div className="action-dock" aria-label="Package actions">
      {actions.map((item) => (
        <button
          key={item.title}
          type="button"
          disabled={item.disabled}
          onClick={item.action}
        >
          <strong>{item.title}</strong>
          <span>{item.description}</span>
          <b aria-hidden="true">→</b>
        </button>
      ))}
    </div>
  );
}
