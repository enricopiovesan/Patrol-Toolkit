import { describe, expect, it } from "vitest";
import { buildPeakLayers } from "./peak-layers";

describe("buildPeakLayers", () => {
  it("builds marker and label layers for peaks", () => {
    const layers = buildPeakLayers("peaks-src");
    expect(layers.markerLayer.source).toBe("peaks-src");
    expect(layers.markerLayer.id).toBe("resort-peaks-marker");
    expect(layers.labelLayer.source).toBe("peaks-src");
    expect(layers.labelLayer.id).toBe("resort-peaks-label");
    expect(layers.labelLayer.minzoom).toBeGreaterThanOrEqual(10);
    expect(layers.markerLayer.layout?.["text-field"]).toBe("▲");
    expect(layers.labelLayer.layout?.["text-variable-anchor"]).toEqual([
      "top",
      "top-right",
      "top-left",
      "right",
      "left",
      "bottom"
    ]);
    expect(layers.labelLayer.layout?.["text-radial-offset"]).toBe(0.9);
    expect(layers.labelLayer.paint?.["text-halo-width"]).toBe(1.4);
  });
});
