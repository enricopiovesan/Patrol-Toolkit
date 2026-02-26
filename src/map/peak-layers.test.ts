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
  });
});
