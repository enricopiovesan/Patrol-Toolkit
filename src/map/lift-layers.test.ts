import { describe, expect, it } from "vitest";
import {
  buildLiftLayers,
  RESORT_LIFTS_LABEL_LAYER_ID,
  RESORT_LIFTS_LINE_LAYER_ID,
  RESORT_LIFT_TOWERS_CIRCLE_LAYER_ID,
  RESORT_LIFT_TOWERS_LABEL_LAYER_ID
} from "./lift-layers";

describe("lift layer specs", () => {
  it("builds deterministic lift and tower layer configs", () => {
    const layers = buildLiftLayers("resort-lifts", "resort-lift-towers");

    expect(layers.lineLayer).toEqual({
      id: RESORT_LIFTS_LINE_LAYER_ID,
      type: "line",
      source: "resort-lifts",
      paint: {
        "line-color": "#b91c1c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 3.2, 16, 4.6],
        "line-opacity": 0.95
      }
    });

    expect(layers.labelLayer.id).toBe(RESORT_LIFTS_LABEL_LAYER_ID);
    expect(layers.labelLayer.type).toBe("symbol");
    expect(layers.labelLayer.source).toBe("resort-lifts");
    expect(layers.labelLayer.layout).toEqual({
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

    expect(layers.towerCircleLayer).toEqual({
      id: RESORT_LIFT_TOWERS_CIRCLE_LAYER_ID,
      type: "circle",
      source: "resort-lift-towers",
      paint: {
        "circle-color": "#7f1d1d",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 3.5, 17, 4.5],
        "circle-stroke-color": "#fee2e2",
        "circle-stroke-width": 1,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.75, 15, 1]
      }
    });

    expect(layers.towerLabelLayer.id).toBe(RESORT_LIFT_TOWERS_LABEL_LAYER_ID);
    expect(layers.towerLabelLayer.type).toBe("symbol");
    expect(layers.towerLabelLayer.source).toBe("resort-lift-towers");
    expect(layers.towerLabelLayer.layout).toEqual({
      "text-field": ["to-string", ["get", "towerNumber"]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9, 17, 11],
      "text-font": ["Noto Sans Regular"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-ignore-placement": false,
      "text-allow-overlap": false
    });
  });
});
