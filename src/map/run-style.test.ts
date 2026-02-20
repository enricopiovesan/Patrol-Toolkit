import { describe, expect, it } from "vitest";
import {
  buildRunLineColorExpression,
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
      "line-opacity": 0.94
    });
  });
});
