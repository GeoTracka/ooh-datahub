import * as Tabs from "@radix-ui/react-tabs";
import { useEffect } from "react";
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
  const effectiveActive = active === "influence" && !influenceAvailable
    ? "plan"
    : active;

  useEffect(() => {
    if (active !== effectiveActive) onChange(effectiveActive);
  }, [active, effectiveActive, onChange]);

  return (
    <>
      <Tabs.Root
        value={effectiveActive}
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
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {lenses.map((lens) => (
          <Tabs.Content
            key={lens.id}
            value={lens.id}
            forceMount
            className="sr-only"
          >
            {lens.label} map lens
          </Tabs.Content>
        ))}
      </Tabs.Root>
      {lenses.map((lens) => lens.reason ? (
        <span key={lens.id} id={lens.id + "-reason"} className="sr-only">
          {lens.reason}
        </span>
      ) : null)}
    </>
  );
}
