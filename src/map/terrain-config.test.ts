import { describe, expect, it } from "vitest";
import {
  TERRAIN_CONTOUR_COLORS,
  TERRAIN_CONTOUR_LABEL_FONT,
  TERRAIN_CONTOUR_LABEL_MIN_ZOOM,
  TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM,
  TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS,
  TERRAIN_CONTOUR_MINOR_INTERVAL_METERS,
  TERRAIN_FAUX_SHADING_INTENSITY,
  TERRAIN_HYPSOMETRIC_COLOR_STOPS,
  TERRAIN_HYPSOMETRIC_FILL_OPACITY,
  TERRAIN_OVERLAY_LAYER_ORDER,
  buildContourLabelFilterExpression,
  buildMajorContourFilterExpression,
  isMajorContourElevationMeters
} from "./terrain-config";

describe("terrain-config", () => {
  it("exposes centralized terrain contour constants", () => {
    expect({
      minorInterval: TERRAIN_CONTOUR_MINOR_INTERVAL_METERS,
      majorInterval: TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS,
      labelMinZoom: TERRAIN_CONTOUR_LABEL_MIN_ZOOM,
      minorLabelMinZoom: TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM,
      colors: TERRAIN_CONTOUR_COLORS,
      labelFont: TERRAIN_CONTOUR_LABEL_FONT,
      hypsometricStops: TERRAIN_HYPSOMETRIC_COLOR_STOPS,
      hypsometricOpacity: TERRAIN_HYPSOMETRIC_FILL_OPACITY,
      fauxShadingIntensity: TERRAIN_FAUX_SHADING_INTENSITY
    }).toMatchInlineSnapshot(`
      {
        "colors": {
          "label": "#7f8f9b",
          "labelHalo": "#f6fbff",
          "major": "#6f8faa",
          "minor": "#9fb4c6",
        },
        "fauxShadingIntensity": 1.65,
        "hypsometricOpacity": 0.22,
        "hypsometricStops": [
          0,
          "#f6faf9",
          1400,
          "#f1f7fa",
          1800,
          "#edf4f9",
          2200,
          "#f5f8fc",
          2800,
          "#ffffff",
        ],
        "labelFont": [
          "Noto Sans Regular",
        ],
        "labelMinZoom": 13,
        "majorInterval": 100,
        "minorInterval": 20,
        "minorLabelMinZoom": 15,
      }
    `);
  });

  it("classifies major contours deterministically", () => {
    expect(isMajorContourElevationMeters(2200)).toBe(true);
    expect(isMajorContourElevationMeters(2220)).toBe(false);
    expect(isMajorContourElevationMeters(0)).toBe(true);
    expect(isMajorContourElevationMeters(null)).toBe(false);
    expect(isMajorContourElevationMeters(NaN)).toBe(false);
  });

  it("builds shared contour filter expressions", () => {
    expect(buildMajorContourFilterExpression()).toEqual([
      "all",
      ["has", "elevationMeters"],
      ["==", ["%", ["to-number", ["get", "elevationMeters"]], 100], 0]
    ]);
    expect(buildContourLabelFilterExpression()).toEqual([
      "all",
      ["has", "elevationMeters"],
      ["==", ["%", ["to-number", ["get", "elevationMeters"]], 100], 0]
    ]);
  });

  it("defines terrain overlay ordering contract", () => {
    expect(TERRAIN_OVERLAY_LAYER_ORDER).toEqual(["terrainBands", "areas", "contours", "peaks", "runs", "lifts"]);
  });
});
