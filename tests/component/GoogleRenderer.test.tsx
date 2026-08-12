import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleScene } from "@/contracts/renderer";
import { GoogleRenderer } from "@/maps/GoogleRenderer";

const mapApi = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  moveCamera: vi.fn(),
  getDiv: vi.fn(() => ({ clientWidth: 1000, clientHeight: 700 })),
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMap: () => mapApi,
}));

afterEach(() => vi.unstubAllGlobals());

const scene: GoogleScene = {
  kind: "google",
  features: [
    {
      id: "ikeja",
      coordinate: [3.35, 6.6],
      sourceProduct: "google.geocoding.v4",
      attributionId: "google-maps",
    },
    {
      id: "vi",
      coordinate: [3.43, 6.43],
      sourceProduct: "google.geocoding.v4",
      attributionId: "google-maps",
    },
  ],
  attributionIds: ["google-maps"],
  noMapFallback: { features: [], attributionIds: [] },
};

describe("GoogleRenderer", () => {
  beforeEach(() => {
    mapApi.fitBounds.mockClear();
    mapApi.moveCamera.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ enabled: true, browserKey: "restricted-browser-fixture" }),
    }));
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  it("renders Google Maps attribution in the same visual container", async () => {
    render(<GoogleRenderer scene={{
      kind: "google",
      features: [{
        id: "google-geocode",
        coordinate: [3.38, 6.52],
        sourceProduct: "google.geocoding.v4",
        attributionId: "google-maps",
      }],
      attributionIds: ["google-maps"],
      noMapFallback: {
        features: [{
          id: "google-geocode",
          coordinate: [3.38, 6.52],
          sourceProduct: "google.geocoding.v4",
          attributionId: "google-maps",
        }],
        attributionIds: ["google-maps"],
      },
    }} />);
    expect(await screen.findByText("Google Maps")).toBeInTheDocument();
    expect(screen.getByText("Google Maps").closest("[data-testid='google-renderer']"))
      .not.toBeNull();
  });

  it("fits the complete package bounds in overview", async () => {
    render(
      <GoogleRenderer
        scene={scene}
        cameraRequest={{ mode: "overview", revision: 0 }}
      />,
    );

    await waitFor(() => expect(mapApi.fitBounds).toHaveBeenCalledWith({
      west: 3.35,
      south: 6.43,
      east: 3.43,
      north: 6.6,
    }, 64));
  });

  it("refocuses the same selected zone when a new explicit request arrives", async () => {
    const view = render(
      <GoogleRenderer
        scene={scene}
        selectedFeatureId="ikeja"
        cameraRequest={{ mode: "selected", revision: 0 }}
      />,
    );
    await waitFor(() => expect(mapApi.moveCamera).toHaveBeenCalledWith({
      center: { lng: 3.35, lat: 6.6 },
      zoom: 12.5,
    }));
    mapApi.moveCamera.mockClear();

    view.rerender(
      <GoogleRenderer
        scene={scene}
        selectedFeatureId="ikeja"
        cameraRequest={{ mode: "selected", revision: 1 }}
      />,
    );
    await waitFor(() => expect(mapApi.moveCamera).toHaveBeenCalledTimes(1));
  });

  it("preserves guaranteed package bounds when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(
      <GoogleRenderer
        scene={scene}
        cameraRequest={{ mode: "overview", revision: 0 }}
      />,
    );

    await waitFor(() => expect(mapApi.moveCamera).toHaveBeenCalledWith({
      center: {
        lng: expect.closeTo(3.39, 10),
        lat: expect.closeTo(6.5150072004, 9),
      },
      zoom: expect.closeTo(12.1987703683, 9),
    }));
    expect(mapApi.fitBounds).not.toHaveBeenCalled();
  });
});
