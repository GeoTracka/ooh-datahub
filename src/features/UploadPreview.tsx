import type { ValidatedInventoryRow } from "@/import/validateRows";

export function UploadPreview({
  rows,
  selected,
  onToggle,
}: {
  rows: ValidatedInventoryRow[];
  selected: Set<string>;
  onToggle(assetId: string): void;
}) {
  return (
    <fieldset>
      <legend>Select up to 50 accepted rows</legend>
      {rows.map((row) => (
        <label key={row.assetId}>
          <input
            type="checkbox"
            checked={selected.has(row.assetId)}
            disabled={!selected.has(row.assetId) && selected.size >= 50}
            onChange={() => onToggle(row.assetId)}
          />
          {row.assetId} · {row.address ?? `${row.latitude}, ${row.longitude}`} ·
          {row.modelEligible ? " model-eligible input" : " context-only"}
        </label>
      ))}
    </fieldset>
  );
}
