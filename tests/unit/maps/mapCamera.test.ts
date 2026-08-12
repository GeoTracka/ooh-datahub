import { describe, expect, it } from "vitest";
import {
  fitWebMercatorBoundsCamera,
  resolvePackageCameraTarget,
} from "@/maps/mapCamera";

describe("resolvePackageCameraTarget", () => {
  it("returns the deterministic Lagos fallback when the package has no coordinates", () => {
    expect(resolvePackageCameraTarget([])).toEqual({
      kind: "center",
      center: [3.39, 6.53],
      zoom: 10.5,
    });
  });

  it("centers a package with one coordinate without inventing bounds", () => {
    expect(resolvePackageCameraTarget([[3.35, 6.57]])).toEqual({
      kind: "center",
      center: [3.35, 6.57],
      zoom: 12.5,
    });
  });

  it("returns deterministic bounds containing every package coordinate", () => {
    expect(resolvePackageCameraTarget([
      [3.62, 6.45],
      [3.25, 6.61],
      [3.47, 6.52],
    ])).toEqual({
      kind: "bounds",
      bounds: [[3.25, 6.45], [3.62, 6.61]],
    });
  });
});

describe("fitWebMercatorBoundsCamera", () => {
  it("fits representative Lagos bounds inside the padded viewport", () => {
    const camera = fitWebMercatorBoundsCamera(
      [[3.35, 6.43], [3.43, 6.6]],
      { width: 1000, height: 700 },
      64,
    );

    expect(camera.center[0]).toBeCloseTo(3.39, 10);
    expect(camera.center[1]).toBeCloseTo(6.5150072004, 9);
    expect(camera.zoom).toBeCloseTo(12.1987703683, 9);
  });

  it("clamps world limits and returns finite output for unusable viewport dimensions", () => {
    const camera = fitWebMercatorBoundsCamera(
      [[-200, -90], [200, 90]],
      { width: 0, height: -10 },
      1000,
    );

    expect(camera.center[0]).toBe(0);
    expect(camera.center[1]).toBeCloseTo(0, 10);
    expect(camera.zoom).toBe(0);
    expect(camera.center.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(camera.zoom)).toBe(true);
  });

  it("caps degenerate bounds at a finite maximum zoom", () => {
    const camera = fitWebMercatorBoundsCamera(
      [[3.39, 6.53], [3.39, 6.53]],
      { width: 1000, height: 700 },
      64,
    );

    expect(camera.center[0]).toBeCloseTo(3.39, 10);
    expect(camera.center[1]).toBeCloseTo(6.53, 10);
    expect(camera.zoom).toBe(21);
  });
});
