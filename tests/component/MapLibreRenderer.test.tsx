import { forwardRef, useLayoutEffect, useRef, type ForwardedRef, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLibreScene } from "@/contracts/renderer";
import { MapLibreRenderer } from "@/maps/MapLibreRenderer";
import { MAPLIBRE_WORKER_URL } from "@/maps/mapAssets";

const mapApi = vi.hoisted(() => ({
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  getCanvas: vi.fn(() => document.createElement("canvas")),
}));
const setWorkerUrl = vi.hoisted(() => vi.fn());
const mapViewMounts = vi.hoisted(() => vi.fn());

function assignRef(ref: ForwardedRef<unknown>, value: unknown) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

vi.mock("maplibre-gl", () => ({ setWorkerUrl }));
vi.mock("@vis.gl/react-maplibre", () => ({
  default: forwardRef(function MockMapView(
    { children, onLoad, onSourceData, onError }: {
      children?: ReactNode;
      onLoad?(): void;
      onSourceData?(event: { sourceId: string; isSourceLoaded: boolean }): void;
      onError?(event: { sourceId?: string; error: Error }): void;
    },
    ref,
  ) {
    mapViewMounts();
    const initialOnLoad = useRef(onLoad);
    useLayoutEffect(() => {
      assignRef(ref, mapApi);
      initialOnLoad.current?.();
      return () => assignRef(ref, null);
    }, [ref]);
    return <div data-testid="mock-map-view">
      <button type="button" onClick={() => onSourceData?.({ sourceId: "context", isSourceLoaded: true })}>load context</button>
      <button type="button" onClick={() => onError?.({ sourceId: "context", error: new Error("context failed") })}>fail context</button>
      <button type="button" onClick={() => onError?.({ sourceId: "other", error: new Error("other failed") })}>fail other</button>
      <button type="button" onClick={() => onError?.({ error: new Error("Failed to fetch") })}>fail source-less fetch</button>
      <button type="button" onClick={() => onError?.({ error: new Error("WebGL context lost") })}>fail source-less WebGL</button>
      <button type="button" onClick={() => {
        onSourceData?.({ sourceId: "context", isSourceLoaded: true });
        onError?.({ sourceId: "context", error: new Error("context failed") });
      }}>load then fail context</button>
      <button type="button" onClick={() => {
        onSourceData?.({ sourceId: "context", isSourceLoaded: true });
        onError?.({ error: new Error("Failed to fetch") });
      }}>load then fail source-less fetch</button>
      {children}
    </div>;
  }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const scene: MapLibreScene = {
  kind: "maplibre",
  attributionIds: [],
  features: [
    {
      id: "ikeja",
      coordinate: [3.35, 6.6],
      sourceProduct: "synthetic",
      visual: {
        label: "Ikeja",
        metricLabel: "Additional people reached",
        value: 24_000,
        unit: "people",
        evidenceLabel: "Early estimate",
      },
    },
    {
      id: "vi",
      coordinate: [3.43, 6.43],
      sourceProduct: "synthetic",
      visual: {
        label: "Victoria Island",
        metricLabel: "Additional people reached",
        value: 31_000,
        unit: "people",
        evidenceLabel: "Early estimate",
      },
    },
    { id: "oshodi", coordinate: [3.32, 6.55], sourceProduct: "synthetic" },
  ],
};

describe("MapLibreRenderer camera", () => {
  beforeEach(() => {
    mapApi.flyTo.mockClear();
    mapApi.fitBounds.mockClear();
    mapViewMounts.mockClear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers the exact revisioned MapLibre worker URL", () => {
    expect(setWorkerUrl).toHaveBeenCalledWith(MAPLIBRE_WORKER_URL);
  });

  it("fits every package coordinate for overview", async () => {
    render(
      <MapLibreRenderer
        scene={scene}
        selectedFeatureId={null}
        cameraRequest={{ mode: "overview", revision: 0 }}
      />,
    );

    await waitFor(() => expect(mapApi.fitBounds).toHaveBeenCalledWith(
      [[3.32, 6.43], [3.43, 6.6]],
      expect.objectContaining({ duration: 400 }),
    ));
  });

  it("refocuses the same selected zone when a new explicit request arrives", async () => {
    const view = render(
      <MapLibreRenderer
        scene={scene}
        selectedFeatureId="ikeja"
        cameraRequest={{ mode: "selected", revision: 0 }}
      />,
    );
    await waitFor(() => expect(mapApi.flyTo).toHaveBeenCalledWith(expect.objectContaining({
      center: [3.35, 6.6],
      zoom: 12.5,
      duration: 400,
    })));
    mapApi.flyTo.mockClear();

    view.rerender(
      <MapLibreRenderer
        scene={scene}
        selectedFeatureId="ikeja"
        cameraRequest={{ mode: "selected", revision: 1 }}
      />,
    );
    await waitFor(() => expect(mapApi.flyTo).toHaveBeenCalledTimes(1));
  });

  it("removes camera animation when reduced motion is requested", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(
      <MapLibreRenderer
        scene={scene}
        selectedFeatureId={null}
        cameraRequest={{ mode: "overview", revision: 0 }}
      />,
    );

    await waitFor(() => expect(mapApi.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 0 }),
    ));
  });

  it("renders only the sparse local orientation allowlist", () => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);

    const labels = document.querySelectorAll("[data-map-orientation-label]");
    expect(labels).toHaveLength(4);
    expect([...labels].map((label) => label.textContent)).toEqual([
      "Third Mainland Bridge",
      "Ikorodu Road",
      "Lagos-Ibadan Expressway",
      "Lagos Lagoon",
    ]);
  });

  it("keeps package captions visible and strengthens the selected caption", () => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId="ikeja" />);

    const selectedCaption = document.querySelector(".map-marker-caption.selected");
    expect(selectedCaption).toHaveTextContent("Ikeja");
    expect(document.querySelectorAll(".map-marker-caption")).toHaveLength(2);
    expect(document.querySelector(".map-marker-caption:not(.selected)"))
      .toHaveTextContent("Victoria Island");
  });

  it("shows delayed loading feedback, then clears it when context loads", async () => {
    vi.useFakeTimers();
    try {
      render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
      expect(screen.queryByText("Loading the Lagos planning map…")).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(300));
      expect(screen.queryByText("Loading the Lagos planning map…")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("status")).toHaveTextContent("Loading the Lagos planning map…");

      fireEvent.click(screen.getByRole("button", { name: "load context" }));
      expect(screen.queryByText("Loading the Lagos planning map…")).not.toBeInTheDocument();
      expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "loaded");
      expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("aria-busy", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("enters a degraded state for context errors while package locations remain available", () => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "fail context" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The Lagos planning map is unavailable. Package locations are still shown.",
    );
    expect(screen.getByRole("button", { name: "Retry map" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ikeja|Victoria Island|oshodi/ })).toHaveLength(3);
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "error");
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("aria-busy", "false");
  });

  it("ignores unrelated errors and errors emitted after context is ready", () => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "fail other" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "load context" }));
    fireEvent.click(screen.getByRole("button", { name: "fail context" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "loaded");
  });

  it.each([
    "load then fail context",
    "load then fail source-less fetch",
  ])("keeps context loaded when %s is emitted in the same tick", (action) => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);

    act(() => fireEvent.click(screen.getByRole("button", { name: action })));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "loaded");
  });

  it("accepts narrow source-less fetch failures but ignores source-less WebGL errors", () => {
    const view = render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "fail source-less WebGL" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "loading");

    view.unmount();
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "fail source-less fetch" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "error");
  });

  it("retries by remounting only MapView and resets to loading", async () => {
    render(<MapLibreRenderer scene={scene} selectedFeatureId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "fail context" }));
    const mountsBeforeRetry = mapViewMounts.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));

    expect(mapViewMounts.mock.calls.length).toBeGreaterThan(mountsBeforeRetry);
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("data-context-state", "loading");
    expect(screen.getByTestId("maplibre-renderer")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Ikeja|Victoria Island|oshodi/ })).toHaveLength(3));
  });
});
