import { describe, expect, it } from "vitest";
import {
  buildContourLabelLayout,
  buildContourLabelPaint,
  buildContourMajorLinePaint,
  buildContourMinorLinePaint
} from "./contour-style";

describe("contour-style", () => {
  it("builds minor contour line paint", () => {
    expect(buildContourMinorLinePaint()).toEqual({
      "line-color": "#8f735f",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 13, 1.05, 16, 1.35],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.13, 15, 0.2]
    });
  });

  it("builds major contour line paint", () => {
    expect(buildContourMajorLinePaint()).toEqual({
      "line-color": "#6b4f3a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 13, 1.35, 16, 2],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.22, 15, 0.34]
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
      "text-color": "#5b4637",
      "text-halo-color": "#f6f1ea",
      "text-halo-width": 1.35,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 0.34, 16, 0.4]
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
      "text-color": "#5b4637",
      "text-halo-color": "#f6f1ea",
      "text-halo-width": 1.1,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0, 15.4, 0.18, 17, 0.24]
    });
  });
});
