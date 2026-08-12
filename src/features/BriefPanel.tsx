import type { Brief } from "@/contracts/domain";

export function BriefPanel({
  brief,
  onChange,
  onBuild,
  onUpload,
}: {
  brief: Brief;
  onChange(change: Partial<Brief>): void;
  onBuild(): void;
  onUpload(): void;
}) {
  return (
    <form className="brief-panel" onSubmit={(event) => {
      event.preventDefault();
      onBuild();
    }}>
      <h1>Campaign planner</h1>
      <label>Product name<input value={brief.productName} onChange={(event) => onChange({ productName: event.target.value })} /></label>
      <label>Product information<textarea value={brief.productDescription} onChange={(event) => onChange({ productDescription: event.target.value })} /></label>
      <label>Target audience<textarea value={brief.targetAudience} onChange={(event) => onChange({ targetAudience: event.target.value })} /></label>
      <label>Sector<select value={brief.sector} onChange={(event) => onChange({ sector: event.target.value as Brief["sector"] })}>
        <option value="fmcg">Consumer goods</option>
        <option value="real_estate">Real Estate</option>
        <option value="bank_fintech">Bank / Fintech</option>
      </select></label>
      <label>Objective<select value={brief.objective} onChange={(event) => onChange({ objective: event.target.value as Brief["objective"] })}>
        <option value="broad_reach">Broad reach</option>
        <option value="influential_core">Priority audience</option>
        <option value="near_conversion">Likely customers</option>
      </select></label>
      <label>Campaign time<select value={brief.daypart} onChange={(event) => onChange({ daypart: event.target.value as Brief["daypart"] })}>
        <option value="all_day">All day</option><option value="am">Morning</option>
        <option value="midday">Midday</option><option value="pm">Afternoon</option>
        <option value="evening">Evening</option>
      </select></label>
      <label>Budget (NGN)<input type="number" min={1} value={brief.budgetNgn} onChange={(event) => onChange({ budgetNgn: Number(event.target.value) })} /></label>
      <button type="submit">Build campaign</button>
      <button type="button" onClick={onUpload}>Upload spreadsheet</button>
    </form>
  );
}
