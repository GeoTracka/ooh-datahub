import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapCanvas } from "@/maps/MapCanvas";

vi.mock("@/maps/GoogleRenderer", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  return { GoogleRenderer: ({ scene }: { scene: { features: Array<{ id: string }> } }) => {
    const [selected, setSelected] = useState<string | null>(null);
    return <div data-testid="google-renderer">
      {scene.features.map((feature) => <button key={feature.id} onClick={() => setSelected(feature.id)}>{feature.id}</button>)}
      {selected && <span>selected:{selected}</span>}
      <span>Google Maps</span>
    </div>;
  }};
});
vi.mock("@/maps/MapLibreRenderer", () => ({
  MapLibreRenderer: ({ scene }: { scene: { features: Array<{ id: string }> } }) =>
    <div data-testid="maplibre-renderer">{scene.features.map((feature) => <span key={feature.id}>{feature.id}</span>)}</div>,
}));

describe("MapCanvas", () => {
  it("destroys Google markers, attribution and selection on a MapLibre switch", async () => {
    const google = {
      kind: "google" as const,
      features: [{ id: "google-geocode", coordinate: [3.38, 6.52] as [number, number], sourceProduct: "google.geocoding.v4", attributionId: "google-maps" }],
      attributionIds: ["google-maps"],
      noMapFallback: { features: [], attributionIds: [] },
    };
    const maplibre = {
      kind: "maplibre" as const,
      features: [{ id: "synthetic-zone", coordinate: [3.37, 6.51] as [number, number], sourceProduct: "synthetic" }],
      attributionIds: [],
    };
    const view = render(<MapCanvas scene={google} />);
    await userEvent.click(screen.getByRole("button", { name: "google-geocode" }));
    expect(screen.getByText("selected:google-geocode")).toBeInTheDocument();
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
    view.rerender(<MapCanvas scene={maplibre} />);
    expect(screen.queryByTestId("google-renderer")).not.toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toBeInTheDocument();
    expect(screen.queryByText(/google-geocode|Google Maps/)).not.toBeInTheDocument();
  });
});
