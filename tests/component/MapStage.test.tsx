import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLibreScene } from "@/contracts/renderer";
import { MapStage } from "@/features/MapStage";

const mapCanvasProps = vi.hoisted(() => vi.fn());

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: (props: unknown) => {
    mapCanvasProps(props);
    return <div data-testid="map-canvas" />;
  },
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
  beforeEach(() => mapCanvasProps.mockClear());

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

  it("keeps the pre-recommendation planning canvas free of irrelevant camera controls", () => {
    render(
      <MapStage
        scene={{ ...scene, features: [] }}
        selectedFeatureId={null}
        onFeatureSelect={() => undefined}
      />,
    );

    expect(screen.queryByRole("group", { name: "Map camera" }))
      .not.toBeInTheDocument();
  });

  it("offers a compact package overview action while selected-zone focus is unavailable", async () => {
    render(
      <MapStage
        scene={scene}
        selectedFeatureId={null}
        onFeatureSelect={() => undefined}
      />,
    );

    const toolbar = screen.getByRole("group", { name: "Map camera" });
    expect(toolbar).toHaveClass("explorer-map-camera-toolbar");
    const overview = screen.getByRole("button", { name: "Package overview" });
    expect(overview).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Focus selected zone" })).toBeDisabled();

    await userEvent.click(overview);
    await waitFor(() => expect(mapCanvasProps.mock.lastCall?.[0]).toMatchObject({
      cameraRequest: { mode: "overview", revision: 1 },
    }));
  });

  it("enables explicit refocus and propagates repeated requests for the same selection", async () => {
    render(
      <MapStage
        scene={scene}
        selectedFeatureId="yaba"
        onFeatureSelect={() => undefined}
      />,
    );

    const focus = screen.getByRole("button", { name: "Focus selected zone" });
    expect(focus).toBeEnabled();
    expect(focus).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(focus);
    await waitFor(() => expect(mapCanvasProps.mock.lastCall?.[0]).toMatchObject({
      cameraRequest: { mode: "selected", revision: 1 },
    }));
  });
});
