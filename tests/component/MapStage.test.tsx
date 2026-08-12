import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapLibreScene } from "@/contracts/renderer";
import { MapStage } from "@/features/MapStage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

const scene: MapLibreScene = {
  kind: "maplibre",
  attributionIds: [],
  features: [{
    id: "yaba",
    coordinate: [3.38, 6.52],
    sourceProduct: "synthetic",
    visual: {
      label: "Yaba / Akoka",
      metricLabel: "Marginal target reach",
      value: 12000,
      unit: "people",
      evidenceLabel: "Evidence D",
    },
  }],
};

describe("MapStage", () => {
  it("explains the active lens without relying on marker color or size alone", () => {
    render(
      <MapStage
        scene={scene}
        selectedFeatureId="yaba"
        onFeatureSelect={() => undefined}
      />,
    );

    const legend = screen.getByRole("complementary", { name: "Map lens legend" });
    expect(legend).toHaveTextContent("Marginal target reach");
    expect(legend).toHaveTextContent("Evidence D");
    expect(legend).toHaveTextContent(/Marker number\/size shows the active lens value/);
  });

  it("credits OpenStreetMap contributors", () => {
    render(
      <MapStage
        scene={scene}
        selectedFeatureId="yaba"
        onFeatureSelect={() => undefined}
      />,
    );

    const attribution = screen.getByRole("link", {
      name: /Map data © OpenStreetMap contributors/i,
    });
    expect(attribution).toBeVisible();
    expect(attribution).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
  });
});
