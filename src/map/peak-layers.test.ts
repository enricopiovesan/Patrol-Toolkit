import { describe, expect, it } from "vitest";
import { buildPeakLayers } from "./peak-layers";

describe("buildPeakLayers", () => {
  it("builds circle and label layers for peaks", () => {
    const layers = buildPeakLayers("peaks-src");
    expect(layers.circleLayer.source).toBe("peaks-src");
    expect(layers.circleLayer.id).toBe("resort-peaks-circle");
    expect(layers.labelLayer.source).toBe("peaks-src");
    expect(layers.labelLayer.id).toBe("resort-peaks-label");
    expect(layers.labelLayer.minzoom).toBeGreaterThanOrEqual(10);
  });
});

