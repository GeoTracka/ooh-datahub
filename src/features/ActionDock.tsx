export function ActionDock({
  onReviewRfq,
  onUpload,
  onFineTune,
}: {
  onReviewRfq(): void;
  onUpload(): void;
  onFineTune(): void;
}) {
  const actions = [
    {
      title: "Review RFQ",
      description: "Generate the supplier verification request from the applied package.",
      action: onReviewRfq,
    },
    {
      title: "Upload customer inventory",
      description: "Add customer-owned sites as context without upgrading their evidence state.",
      action: onUpload,
    },
    {
      title: "Fine-tune package",
      description: "Include, swap, replace or remove faces and inspect the exact trade-off.",
      action: onFineTune,
    },
  ];

  return (
    <div className="action-dock" aria-label="Package actions">
      {actions.map((item) => (
        <button key={item.title} type="button" onClick={item.action}>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
          <b aria-hidden="true">→</b>
        </button>
      ))}
    </div>
  );
}
