import {
  buildTerrainBandDarkShadeFilter,
  buildTerrainBandDarkShadePaint,
  buildTerrainBandFillPaint,
  buildTerrainBandLightShadeFilter,
  buildTerrainBandLightShadePaint
} from "./terrain-band-style";

export const RESORT_TERRAIN_BANDS_FILL_LAYER_ID = "resort-terrain-bands-fill";
export const RESORT_TERRAIN_BANDS_SHADE_DARK_LAYER_ID = "resort-terrain-bands-shade-dark";
export const RESORT_TERRAIN_BANDS_SHADE_LIGHT_LAYER_ID = "resort-terrain-bands-shade-light";

export function buildTerrainBandLayers(sourceId: string): {
  fillLayer: {
    id: string;
    type: "fill";
    source: string;
    paint: ReturnType<typeof buildTerrainBandFillPaint>;
  };
  darkShadeLayer: {
    id: string;
    type: "fill";
    source: string;
    filter: ReturnType<typeof buildTerrainBandDarkShadeFilter>;
    paint: ReturnType<typeof buildTerrainBandDarkShadePaint>;
  };
  lightShadeLayer: {
    id: string;
    type: "fill";
    source: string;
    filter: ReturnType<typeof buildTerrainBandLightShadeFilter>;
    paint: ReturnType<typeof buildTerrainBandLightShadePaint>;
  };
} {
  return {
    fillLayer: {
      id: RESORT_TERRAIN_BANDS_FILL_LAYER_ID,
      type: "fill",
      source: sourceId,
      paint: buildTerrainBandFillPaint()
    },
    darkShadeLayer: {
      id: RESORT_TERRAIN_BANDS_SHADE_DARK_LAYER_ID,
      type: "fill",
      source: sourceId,
      filter: buildTerrainBandDarkShadeFilter(),
      paint: buildTerrainBandDarkShadePaint()
    },
    lightShadeLayer: {
      id: RESORT_TERRAIN_BANDS_SHADE_LIGHT_LAYER_ID,
      type: "fill",
      source: sourceId,
      filter: buildTerrainBandLightShadeFilter(),
      paint: buildTerrainBandLightShadePaint()
    }
  };
}
