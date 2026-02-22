import { describe, expect, it } from "vitest";
import { buildAreaFillPaint, buildAreaLabelLayout, buildAreaLabelPaint, buildAreaLinePaint } from "./area-style";

describe("area style mapping", () => {
  it("builds dashed perimeter line paint by area kind", () => {
    expect(buildAreaLinePaint()).toEqual({
      "line-color": [
        "match",
        ["get", "kind"],
        "ridge",
        "#0f4c5c",
        "bowl",
        "#1d4ed8",
        "zone",
        "#0f766e",
        "section",
        "#4f46e5",
        "#334155"
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 13, 2, 16, 2.8],
      "line-dasharray": [3, 2],
      "line-opacity": 0.9
    });
  });

  it("builds low-opacity fill paint by area kind", () => {
    expect(buildAreaFillPaint()).toEqual({
      "fill-color": [
        "match",
        ["get", "kind"],
        "ridge",
        "#0f4c5c",
        "bowl",
        "#1d4ed8",
        "zone",
        "#0f766e",
        "section",
        "#4f46e5",
        "#334155"
      ],
      "fill-opacity": 0.04
    });
  });

  it("builds area label layout", () => {
    expect(buildAreaLabelLayout()).toEqual({
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 15],
      "text-font": ["Noto Sans Regular"],
      "text-transform": "none",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-optional": true
    });
  });

  it("builds area label paint", () => {
    expect(buildAreaLabelPaint()).toEqual({
      "text-color": "#0f172a",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1]
    });
  });
});
