import { describe, expect, it } from "vitest";
import {
  buildRunArrowLayout,
  buildRunArrowPaint,
  buildRunLineDasharrayExpression,
  buildRunLineColorExpression,
  buildRunLabelLayout,
  buildRunLabelPaint,
  buildRunLinePaint,
  buildRunLineWidthExpression,
  RUN_DIFFICULTY_COLORS
} from "./run-style";

describe("run style mapping", () => {
  it("defines a deterministic difficulty palette", () => {
    expect(RUN_DIFFICULTY_COLORS).toEqual({
      green: "#16a34a",
      blue: "#2563eb",
      black: "#111827",
      "double-black": "#7f1d1d"
    });
  });

  it("builds maplibre match expression for difficulty colors with fallback", () => {
    expect(buildRunLineColorExpression()).toEqual([
      "match",
      ["get", "difficulty"],
      "green",
      "#16a34a",
      "blue",
      "#2563eb",
      "black",
      "#111827",
      "double-black",
      "#7f1d1d",
      "#475569"
    ]);
  });

  it("builds zoom-scaled line width expression", () => {
    expect(buildRunLineWidthExpression()).toEqual(["interpolate", ["linear"], ["zoom"], 10, 2, 13, 3, 16, 4.5]);
  });

  it("builds dashed styling for double-black runs", () => {
    expect(buildRunLineDasharrayExpression()).toEqual([
      "case",
      ["==", ["get", "difficulty"], "double-black"],
      ["literal", [2.4, 1.4]],
      ["literal", [1, 0]]
    ]);
  });

  it("builds the run line paint config used by map layers", () => {
    expect(buildRunLinePaint()).toEqual({
      "line-color": [
        "match",
        ["get", "difficulty"],
        "green",
        "#16a34a",
        "blue",
        "#2563eb",
        "black",
        "#111827",
        "double-black",
        "#7f1d1d",
        "#475569"
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 13, 3, 16, 4.5],
      "line-dasharray": ["case", ["==", ["get", "difficulty"], "double-black"], ["literal", [2.4, 1.4]], ["literal", [1, 0]]],
      "line-opacity": 0.94
    });
  });

  it("builds run arrow layout for line-following directional markers", () => {
    expect(buildRunArrowLayout()).toEqual({
      "text-field": "➜",
      "symbol-placement": "line",
      "symbol-spacing": 120,
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 13],
      "text-font": ["Noto Sans Regular"],
      "text-keep-upright": false,
      "text-ignore-placement": true,
      "text-allow-overlap": true
    });
  });

  it("builds run arrow paint with neutral haloed styling", () => {
    expect(buildRunArrowPaint()).toEqual({
      "text-color": "#111827",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 0.9,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13, 0.75, 16, 0.9]
    });
  });

  it("builds run label layout for line-following labels with zoom scaling", () => {
    expect(buildRunLabelLayout()).toEqual({
      "text-field": ["get", "name"],
      "symbol-placement": "line",
      "symbol-spacing": 300,
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 15],
      "text-font": ["Noto Sans Regular"],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-optional": true,
      "text-max-angle": 45
    });
  });

  it("builds run label paint with halo and zoom-gated opacity", () => {
    expect(buildRunLabelPaint()).toEqual({
      "text-color": "#0f172a",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1]
    });
  });
});
