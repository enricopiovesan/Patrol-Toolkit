import { describe, expect, it } from "vitest";
import {
  TERRAIN_CONTOUR_COLORS,
  TERRAIN_CONTOUR_LABEL_FONT,
  TERRAIN_CONTOUR_LABEL_MIN_ZOOM,
  TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM,
  TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS,
  TERRAIN_CONTOUR_MINOR_INTERVAL_METERS,
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
      labelFont: TERRAIN_CONTOUR_LABEL_FONT
    }).toMatchInlineSnapshot(`
      {
        "colors": {
          "label": "#5b4637",
          "labelHalo": "#f6f1ea",
          "major": "#6b4f3a",
          "minor": "#8f735f",
        },
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
    expect(TERRAIN_OVERLAY_LAYER_ORDER).toEqual(["areas", "contours", "peaks", "runs", "lifts"]);
  });
});
