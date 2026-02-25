export type PeakLayers = {
  circleLayer: maplibregl.CircleLayerSpecification;
  labelLayer: maplibregl.SymbolLayerSpecification;
};

export function buildPeakLayers(sourceId: string): PeakLayers {
  return {
    circleLayer: {
      id: "resort-peaks-circle",
      type: "circle",
      source: sourceId,
      minzoom: 10,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 4, 17, 5.5],
        "circle-color": "#f8fafc",
        "circle-stroke-color": "#334155",
        "circle-stroke-width": 1.25
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
          ["format", ["get", "name"], {}],
          ["to-string", ["get", "id"]]
        ],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12],
        "text-offset": [0.8, -0.6],
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

