import * as Tabs from "@radix-ui/react-tabs";
import type { MapLens } from "@/contracts/renderer";

export function LensTabs({
  active,
  onChange,
  influenceAvailable,
}: {
  active: MapLens;
  onChange(value: MapLens): void;
  influenceAvailable: boolean;
}) {
  const lenses: { id: MapLens; label: string; disabled: boolean; reason?: string }[] = [
    { id: "plan", label: "Plan", disabled: false },
    { id: "activity", label: "Activity", disabled: false },
    { id: "reach", label: "Reach", disabled: false },
    {
      id: "influence",
      label: "Influence",
      disabled: !influenceAvailable,
      reason: influenceAvailable ? undefined : "Influence profile not configured",
    },
  ];

  return (
    <Tabs.Root
      value={active}
      onValueChange={(value) => onChange(value as MapLens)}
      activationMode="automatic"
    >
      <Tabs.List aria-label="Map lens">
        {lenses.map((lens) => (
          <Tabs.Trigger
            key={lens.id}
            value={lens.id}
            aria-describedby={lens.reason ? lens.id + "-reason" : undefined}
            disabled={lens.disabled}
          >
            {lens.label}
            {lens.reason && (
              <span id={lens.id + "-reason"} className="sr-only">{lens.reason}</span>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
