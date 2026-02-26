import { buildTerrainBandFillPaint } from "./terrain-band-style";

export const RESORT_TERRAIN_BANDS_FILL_LAYER_ID = "resort-terrain-bands-fill";

export function buildTerrainBandLayers(sourceId: string): {
  fillLayer: {
    id: string;
    type: "fill";
    source: string;
    paint: ReturnType<typeof buildTerrainBandFillPaint>;
  };
} {
  return {
    fillLayer: {
      id: RESORT_TERRAIN_BANDS_FILL_LAYER_ID,
      type: "fill",
      source: sourceId,
      paint: buildTerrainBandFillPaint()
    }
  };
}

