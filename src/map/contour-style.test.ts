import { describe, expect, it } from "vitest";
import {
  buildContourLineLayout,
  buildContourLabelLayout,
  buildContourLabelPaint,
  buildContourMajorLinePaint,
  buildContourMinorLinePaint
} from "./contour-style";

describe("contour-style", () => {
  it("builds minor contour line paint", () => {
    expect(buildContourMinorLinePaint()).toEqual({
      "line-color": "#9fb4c6",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.75, 13, 1.05, 16, 1.3],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.24, 15, 0.34],
      "line-blur": 0.35
    });
  });

  it("builds major contour line paint", () => {
    expect(buildContourMajorLinePaint()).toEqual({
      "line-color": "#6f8faa",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.95, 13, 1.25, 16, 1.75],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.34, 15, 0.5],
      "line-blur": 0.2
    });
  });

  it("builds contour line layout with round joins and caps", () => {
    expect(buildContourLineLayout()).toEqual({
      "line-join": "round",
      "line-cap": "round"
    });
  });

  it("builds contour label layout", () => {
    expect(buildContourLabelLayout()).toEqual({
      "text-field": ["case", ["has", "elevationMeters"], ["concat", ["to-string", ["get", "elevationMeters"]], "m"], ""],
      "symbol-placement": "line",
      "symbol-spacing": 340,
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 11],
      "text-font": ["Noto Sans Regular"],
      "text-max-angle": 40,
      "text-keep-upright": true,
      "text-padding": 2
    });
  });

  it("builds contour label paint", () => {
    expect(buildContourLabelPaint()).toEqual({
      "text-color": "#7f8f9b",
      "text-halo-color": "#f6fbff",
      "text-halo-width": 1.6,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 0.52, 16, 0.62]
    });
  });

  it("builds minor contour label layout and paint with lower density/contrast", () => {
    expect(buildContourLabelLayout("minor")).toEqual({
      "text-field": ["case", ["has", "elevationMeters"], ["concat", ["to-string", ["get", "elevationMeters"]], "m"], ""],
      "symbol-placement": "line",
      "symbol-spacing": 420,
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9.5, 17, 10],
      "text-font": ["Noto Sans Regular"],
      "text-max-angle": 40,
      "text-keep-upright": true,
      "text-padding": 2
    });
    expect(buildContourLabelPaint("minor")).toEqual({
      "text-color": "#7f8f9b",
      "text-halo-color": "#f6fbff",
      "text-halo-width": 1.35,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0, 15.4, 0.3, 17, 0.4]
    });
  });
});
