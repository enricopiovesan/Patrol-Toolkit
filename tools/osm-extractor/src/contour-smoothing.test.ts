import { describe, expect, it } from "vitest";
import { resolveContourSmoothingMode, smoothContourGeoJsonText } from "./contour-smoothing.js";

describe("contour-smoothing", () => {
  it("defaults to super-hard smoothing", () => {
    expect(resolveContourSmoothingMode({})).toBe("super-hard");
  });

  it("validates smoothing mode", () => {
    expect(() => resolveContourSmoothingMode({ PTK_CONTOUR_SMOOTHING: "weird" })).toThrow(/PTK_CONTOUR_SMOOTHING/);
    expect(resolveContourSmoothingMode({ PTK_CONTOUR_SMOOTHING: "hard" })).toBe("hard");
    expect(resolveContourSmoothingMode({ PTK_CONTOUR_SMOOTHING: "super-hard" })).toBe("super-hard");
  });

  it("returns unchanged text when smoothing is off", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { ele: 2200 }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 0]] } }]
    });
    expect(smoothContourGeoJsonText(raw, "off")).toBe(raw);
  });

  it("smooths open contour lines while preserving endpoints", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: 2200 },
          geometry: { type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [2, 1]] }
        }
      ]
    });
    const out = JSON.parse(smoothContourGeoJsonText(raw, "low")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    const coords = out.features[0]!.geometry.coordinates;
    expect(coords[0]).toEqual([0, 0]);
    expect(coords[coords.length - 1]).toEqual([2, 1]);
    expect(coords.length).toBeGreaterThan(4);
  });

  it("smooths closed contour loops and keeps closure", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: 2400 },
          geometry: { type: "LineString", coordinates: [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]] }
        }
      ]
    });
    const out = JSON.parse(smoothContourGeoJsonText(raw, "low")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    const coords = out.features[0]!.geometry.coordinates;
    expect(coords.length).toBeGreaterThan(5);
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it("applies stronger smoothing in medium mode", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: 2200 },
          geometry: { type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [2, 1]] }
        }
      ]
    });
    const low = JSON.parse(smoothContourGeoJsonText(raw, "low")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    const medium = JSON.parse(smoothContourGeoJsonText(raw, "medium")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    expect(medium.features[0]!.geometry.coordinates.length).toBeGreaterThan(low.features[0]!.geometry.coordinates.length);
  });

  it("applies strongest smoothing in hard mode", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: 2200 },
          geometry: { type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [2, 1]] }
        }
      ]
    });
    const medium = JSON.parse(smoothContourGeoJsonText(raw, "medium")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    const hard = JSON.parse(smoothContourGeoJsonText(raw, "hard")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    expect(hard.features[0]!.geometry.coordinates.length).toBeGreaterThan(medium.features[0]!.geometry.coordinates.length);
  });

  it("applies strongest smoothing in super-hard mode", () => {
    const raw = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: 2200 },
          geometry: { type: "LineString", coordinates: [[0, 0], [1, 0], [1, 1], [2, 1]] }
        }
      ]
    });
    const hard = JSON.parse(smoothContourGeoJsonText(raw, "hard")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    const superHard = JSON.parse(smoothContourGeoJsonText(raw, "super-hard")) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
    expect(superHard.features[0]!.geometry.coordinates.length).toBeGreaterThan(hard.features[0]!.geometry.coordinates.length);
  });
});
