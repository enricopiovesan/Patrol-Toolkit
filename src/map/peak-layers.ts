import {
  TERRAIN_PEAK_LABEL_COLOR,
  TERRAIN_PEAK_LABEL_ELEVATION_DETAIL_MIN_ZOOM,
  TERRAIN_PEAK_LABEL_FONT,
  TERRAIN_PEAK_LABEL_HALO_COLOR,
  TERRAIN_PEAK_LABEL_HALO_WIDTH,
  TERRAIN_PEAK_LABEL_MIN_ZOOM,
  TERRAIN_PEAK_LABEL_RADIAL_OFFSET,
  TERRAIN_PEAK_LABEL_SIZE_STOPS,
  TERRAIN_PEAK_LABEL_VARIABLE_ANCHORS,
  TERRAIN_PEAK_MARKER_MIN_ZOOM
} from "./terrain-config";

export type PeakLayers = {
  markerLayer: maplibregl.SymbolLayerSpecification;
  labelLayer: maplibregl.SymbolLayerSpecification;
};

function buildPeakLabelTextField(): unknown[] {
  const simpleLabel: unknown[] = ["coalesce", ["get", "name"], ["to-string", ["get", "id"]]];
  const detailedLabel: unknown[] = [
    "coalesce",
    [
      "format",
      ["get", "name"],
      {},
      "\n",
      {},
      [
        "case",
        ["has", "elevationMeters"],
        ["concat", ["to-string", ["get", "elevationMeters"]], "m"],
        ""
      ],
      { "font-scale": 0.9 }
    ],
    ["to-string", ["get", "id"]]
  ];
  return [
    "step",
    ["zoom"],
    simpleLabel,
    TERRAIN_PEAK_LABEL_ELEVATION_DETAIL_MIN_ZOOM,
    detailedLabel
  ];
}

export function buildPeakLayers(sourceId: string): PeakLayers {
  const peakLabelTextField = buildPeakLabelTextField() as unknown as Exclude<
    maplibregl.SymbolLayerSpecification["layout"],
    undefined
  >["text-field"];
  return {
    markerLayer: {
      id: "resort-peaks-marker",
      type: "symbol",
      source: sourceId,
      minzoom: TERRAIN_PEAK_MARKER_MIN_ZOOM,
      layout: {
        "text-field": "▲",
        "text-font": [...TERRAIN_PEAK_LABEL_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 12, 17, 14],
        "text-offset": [0, 0],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
      paint: {
        "text-color": "#8b5a2b",
        "text-halo-color": TERRAIN_PEAK_LABEL_HALO_COLOR,
        "text-halo-width": 1.1
      }
    },
    labelLayer: {
      id: "resort-peaks-label",
      type: "symbol",
      source: sourceId,
      minzoom: TERRAIN_PEAK_LABEL_MIN_ZOOM,
      layout: {
        "text-field": peakLabelTextField,
        "text-font": [...TERRAIN_PEAK_LABEL_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], ...TERRAIN_PEAK_LABEL_SIZE_STOPS],
        "text-variable-anchor": [...TERRAIN_PEAK_LABEL_VARIABLE_ANCHORS],
        "text-radial-offset": TERRAIN_PEAK_LABEL_RADIAL_OFFSET,
        "text-justify": "auto",
        "text-max-width": 10,
        "text-allow-overlap": false,
        "text-ignore-placement": false
      },
      paint: {
        "text-color": TERRAIN_PEAK_LABEL_COLOR,
        "text-halo-color": TERRAIN_PEAK_LABEL_HALO_COLOR,
        "text-halo-width": TERRAIN_PEAK_LABEL_HALO_WIDTH
      }
    }
  };
}
