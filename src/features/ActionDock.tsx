import { PUBLIC_COPY } from "@/content/plainLanguage";

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
      title: PUBLIC_COPY.rfq.action,
      description: canReviewRfq
        ? PUBLIC_COPY.rfq.description
        : "Resolve the package issues before creating a supplier request.",
      action: onReviewRfq,
      disabled: !canReviewRfq,
    },
    {
      title: "Upload customer inventory",
      description: "Add your inventory to the map and package comparison without changing audience estimates.",
      action: onUpload,
      disabled: false,
    },
    {
      title: PUBLIC_COPY.fineTune.title,
      description: "Add, swap, replace, or remove media locations and see how cost and audience estimates change.",
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
