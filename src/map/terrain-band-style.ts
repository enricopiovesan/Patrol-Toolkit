import { TERRAIN_HYPSOMETRIC_COLOR_STOPS, TERRAIN_HYPSOMETRIC_FILL_OPACITY } from "./terrain-config";

export function buildTerrainBandFillPaint(): {
  "fill-color": unknown[];
  "fill-opacity": number;
} {
  return {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", "elevationMidMeters"]], 0],
      ...TERRAIN_HYPSOMETRIC_COLOR_STOPS
    ],
    "fill-opacity": TERRAIN_HYPSOMETRIC_FILL_OPACITY
  };
}

