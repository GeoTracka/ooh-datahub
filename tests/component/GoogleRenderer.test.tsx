import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleRenderer } from "@/maps/GoogleRenderer";

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => vi.unstubAllGlobals());

describe("GoogleRenderer", () => {
  it("renders Google Maps attribution in the same visual container", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ enabled: true, browserKey: "restricted-browser-fixture" }),
    }));
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
});
