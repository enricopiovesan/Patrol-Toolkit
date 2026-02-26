import { describe, expect, it } from "vitest";
import { buildContourLabelLayout, buildContourLabelPaint, buildContourLinePaint } from "./contour-style";

describe("contour-style", () => {
  it("builds contour line paint", () => {
    expect(buildContourLinePaint()).toEqual({
      "line-color": [
        "case",
        ["all", ["has", "elevationMeters"], ["==", ["%", ["to-number", ["get", "elevationMeters"]], 100], 0]],
        "#334155",
        "#64748b"
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 13, 1.05, 16, 1.6],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.275, 15, 0.41]
    });
  });

  it("builds contour label layout", () => {
    expect(buildContourLabelLayout()).toEqual({
      "text-field": ["case", ["has", "elevationMeters"], ["concat", ["to-string", ["get", "elevationMeters"]], "m"], ""],
      "symbol-placement": "line",
      "symbol-spacing": 260,
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 11],
      "text-font": ["Noto Sans Regular"],
      "text-max-angle": 40
    });
  });

  it("builds contour label paint", () => {
    expect(buildContourLabelPaint()).toEqual({
      "text-color": "#1f2937",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 0.375, 16, 0.45]
    });
  });
});
