import { describe, expect, it } from "vitest";
import { buildRunLayers, RESORT_RUNS_LABEL_LAYER_ID, RESORT_RUNS_LINE_LAYER_ID } from "./run-layers";

describe("run layer specs", () => {
  it("builds deterministic run line and label layer configs", () => {
    const layers = buildRunLayers("resort-runs");

    expect(layers.lineLayer.id).toBe(RESORT_RUNS_LINE_LAYER_ID);
    expect(layers.lineLayer.type).toBe("line");
    expect(layers.lineLayer.source).toBe("resort-runs");
    expect(layers.lineLayer.paint).toEqual({
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

    expect(layers.labelLayer.id).toBe(RESORT_RUNS_LABEL_LAYER_ID);
    expect(layers.labelLayer.type).toBe("symbol");
    expect(layers.labelLayer.source).toBe("resort-runs");
    expect(layers.labelLayer.layout).toEqual({
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
    expect(layers.labelLayer.paint).toEqual({
      "text-color": "#0f172a",
      "text-halo-color": "#f8fafc",
      "text-halo-width": 1.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1]
    });
  });
});
