import { describe, expect, it } from "vitest";
import {
  RESORT_TERRAIN_BANDS_FILL_LAYER_ID,
  RESORT_TERRAIN_BANDS_SHADE_DARK_LAYER_ID,
  RESORT_TERRAIN_BANDS_SHADE_LIGHT_LAYER_ID,
  buildTerrainBandLayers
} from "./terrain-band-layers";

describe("terrain-band-layers", () => {
  it("builds terrain band fill and faux shading layers", () => {
    const layers = buildTerrainBandLayers("terrain-bands-src");
    expect(layers.fillLayer.id).toBe(RESORT_TERRAIN_BANDS_FILL_LAYER_ID);
    expect(layers.fillLayer.type).toBe("fill");
    expect(layers.fillLayer.source).toBe("terrain-bands-src");
    expect(layers.fillLayer.paint["fill-opacity"]).toBe(0.22);
    expect(layers.darkShadeLayer.id).toBe(RESORT_TERRAIN_BANDS_SHADE_DARK_LAYER_ID);
    expect(layers.darkShadeLayer.type).toBe("fill");
    expect(layers.darkShadeLayer.source).toBe("terrain-bands-src");
    expect(layers.darkShadeLayer.filter).toEqual(expect.any(Array));
    expect(layers.lightShadeLayer.id).toBe(RESORT_TERRAIN_BANDS_SHADE_LIGHT_LAYER_ID);
    expect(layers.lightShadeLayer.type).toBe("fill");
    expect(layers.lightShadeLayer.source).toBe("terrain-bands-src");
    expect(layers.lightShadeLayer.filter).toEqual(expect.any(Array));
  });
});
