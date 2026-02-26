import { describe, expect, it } from "vitest";
import { RESORT_TERRAIN_BANDS_FILL_LAYER_ID, buildTerrainBandLayers } from "./terrain-band-layers";

describe("terrain-band-layers", () => {
  it("builds terrain band fill layer", () => {
    const layers = buildTerrainBandLayers("terrain-bands-src");
    expect(layers.fillLayer.id).toBe(RESORT_TERRAIN_BANDS_FILL_LAYER_ID);
    expect(layers.fillLayer.type).toBe("fill");
    expect(layers.fillLayer.source).toBe("terrain-bands-src");
    expect(layers.fillLayer.paint["fill-opacity"]).toBe(0.22);
  });
});

