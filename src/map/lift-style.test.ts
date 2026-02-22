import { describe, expect, it } from "vitest";
import {
  buildLiftCasingLineWidthExpression,
  buildLiftCasingPaint,
  buildLiftLabelLayout,
  buildLiftLabelPaint,
  buildLiftLinePaint,
  buildLiftLineWidthExpression,
  buildLiftTowerCirclePaint,
  buildLiftTowerLabelLayout,
  buildLiftTowerLabelPaint
} from "./lift-style";

describe("lift style mapping", () => {
  it("builds zoom-scaled lift line width expression", () => {
    expect(buildLiftLineWidthExpression()).toEqual(["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 3.2, 16, 4.6]);
  });

  it("builds zoom-scaled lift casing width expression", () => {
    expect(buildLiftCasingLineWidthExpression()).toEqual(["interpolate", ["linear"], ["zoom"], 10, 4.2, 13, 5.8, 16, 7.4]);
  });

  it("builds lift casing paint config", () => {
    expect(buildLiftCasingPaint()).toEqual({
      "line-color": "#fff7ed",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.2, 13, 5.8, 16, 7.4],
      "line-opacity": 0.95
    });
  });

  it("builds lift line paint config", () => {
    expect(buildLiftLinePaint()).toEqual({
      "line-color": "#b91c1c",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 3.2, 16, 4.6],
      "line-opacity": 0.95
    });
  });

  it("builds lift label layout for line-following names", () => {
    expect(buildLiftLabelLayout()).toEqual({
      "text-field": ["get", "name"],
      "symbol-placement": "line",
      "symbol-spacing": 320,
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 14],
      "text-font": ["Noto Sans Regular"],
      "text-ignore-placement": false,
      "text-allow-overlap": false,
      "text-optional": true,
      "text-max-angle": 45
    });
  });

  it("builds lift label paint with halo and zoom gating", () => {
    expect(buildLiftLabelPaint()).toEqual({
      "text-color": "#111827",
      "text-halo-color": "#fff7ed",
      "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 1]
    });
  });

  it("builds tower circle paint", () => {
    expect(buildLiftTowerCirclePaint()).toEqual({
      "circle-color": "#7f1d1d",
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 3.5, 17, 4.5],
      "circle-stroke-color": "#fee2e2",
      "circle-stroke-width": 1,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.75, 15, 1]
    });
  });

  it("builds tower number label layout", () => {
    expect(buildLiftTowerLabelLayout()).toEqual({
      "text-field": ["to-string", ["get", "towerNumber"]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9, 17, 11],
      "text-font": ["Noto Sans Regular"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-ignore-placement": false,
      "text-allow-overlap": false
    });
  });

  it("builds tower number label paint", () => {
    expect(buildLiftTowerLabelPaint()).toEqual({
      "text-color": "#3f0d12",
      "text-halo-color": "#fff7ed",
      "text-halo-width": 1,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15, 1]
    });
  });
});
