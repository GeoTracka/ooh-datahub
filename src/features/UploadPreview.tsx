import type { ValidatedInventoryRow } from "@/import/validateRows";

export function UploadPreview({
  rows,
  selected,
  onToggle,
  disabled = false,
}: {
  rows: ValidatedInventoryRow[];
  selected: Set<string>;
  onToggle(assetId: string): void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="planner-choice-list" disabled={disabled}>
      <legend>Select up to 50 ready rows</legend>
      {rows.map((row) => (
        <label className="planner-choice-control" key={row.assetId}>
          <input
            type="checkbox"
            checked={selected.has(row.assetId)}
            disabled={disabled || (!selected.has(row.assetId) && selected.size >= 50)}
            onChange={() => onToggle(row.assetId)}
          />
          <span>
            {row.assetId} · {row.address ?? `${row.latitude}, ${row.longitude}`} ·
            {row.modelEligible ? " can support audience estimates" : " map and comparison only"}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
