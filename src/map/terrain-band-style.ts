import {
  TERRAIN_FAUX_SHADING_BAND_CYCLE_COUNT,
  TERRAIN_FAUX_SHADING_BAND_INTERVAL_METERS,
  TERRAIN_FAUX_SHADING_DARK_COLOR,
  TERRAIN_FAUX_SHADING_DARK_OPACITY_STOPS,
  TERRAIN_FAUX_SHADING_INTENSITY,
  TERRAIN_FAUX_SHADING_LIGHT_COLOR,
  TERRAIN_FAUX_SHADING_LIGHT_OPACITY_STOPS,
  TERRAIN_HYPSOMETRIC_COLOR_STOPS,
  TERRAIN_HYPSOMETRIC_FILL_OPACITY
} from "./terrain-config";

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

function buildTerrainBandShadePhaseExpression(): unknown[] {
  return [
    "%",
    [
      "floor",
      [
        "/",
        [
          "coalesce",
          ["to-number", ["get", "elevationMinMeters"]],
          ["to-number", ["get", "elevationMidMeters"]],
          0
        ],
        TERRAIN_FAUX_SHADING_BAND_INTERVAL_METERS
      ]
    ],
    TERRAIN_FAUX_SHADING_BAND_CYCLE_COUNT
  ];
}

export function buildTerrainBandDarkShadeFilter(): unknown[] {
  const phase = buildTerrainBandShadePhaseExpression();
  return ["any", ["==", phase, 0], ["==", phase, 1]];
}

export function buildTerrainBandLightShadeFilter(): unknown[] {
  const phase = buildTerrainBandShadePhaseExpression();
  return ["==", phase, 3];
}

export function buildTerrainBandDarkShadePaint(): {
  "fill-color": string;
  "fill-opacity": unknown[];
} {
  const scaledStops = TERRAIN_FAUX_SHADING_DARK_OPACITY_STOPS.map((value, index) =>
    index % 2 === 0 ? value : Number((value * TERRAIN_FAUX_SHADING_INTENSITY).toFixed(6))
  );
  return {
    "fill-color": TERRAIN_FAUX_SHADING_DARK_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], ...scaledStops]
  };
}

export function buildTerrainBandLightShadePaint(): {
  "fill-color": string;
  "fill-opacity": unknown[];
} {
  const scaledStops = TERRAIN_FAUX_SHADING_LIGHT_OPACITY_STOPS.map((value, index) =>
    index % 2 === 0 ? value : Number((value * TERRAIN_FAUX_SHADING_INTENSITY).toFixed(6))
  );
  return {
    "fill-color": TERRAIN_FAUX_SHADING_LIGHT_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], ...scaledStops]
  };
}
