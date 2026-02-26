export type PeakLayers = {
  markerLayer: maplibregl.SymbolLayerSpecification;
  labelLayer: maplibregl.SymbolLayerSpecification;
};

export function buildPeakLayers(sourceId: string): PeakLayers {
  return {
    markerLayer: {
      id: "resort-peaks-marker",
      type: "symbol",
      source: sourceId,
      minzoom: 10,
      layout: {
        "text-field": "▲",
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 12, 17, 14],
        "text-offset": [0, 0],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
      paint: {
        "text-color": "#8b5a2b",
        "text-halo-color": "#f8fafc",
        "text-halo-width": 1.1
      }
    },
    labelLayer: {
      id: "resort-peaks-label",
      type: "symbol",
      source: sourceId,
      minzoom: 11,
      layout: {
        "text-field": [
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
        ],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12],
        "text-offset": [0.9, -0.2],
        "text-anchor": "left",
        "text-allow-overlap": false
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#f8fafc",
        "text-halo-width": 1.25
      }
    }
  };
}
