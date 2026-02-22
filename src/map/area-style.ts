export function buildAreaLinePaint(): {
  "line-color": unknown[];
  "line-width": unknown[];
  "line-dasharray": number[];
  "line-opacity": number;
} {
  return {
    "line-color": [
      "match",
      ["get", "kind"],
      "ridge",
      "#0f4c5c",
      "bowl",
      "#1d4ed8",
      "zone",
      "#0f766e",
      "section",
      "#4f46e5",
      "#334155"
    ],
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 13, 2, 16, 2.8],
    "line-dasharray": [3, 2],
    "line-opacity": 0.9
  };
}

export function buildAreaFillPaint(): {
  "fill-color": unknown[];
  "fill-opacity": number;
} {
  return {
    "fill-color": [
      "match",
      ["get", "kind"],
      "ridge",
      "#0f4c5c",
      "bowl",
      "#1d4ed8",
      "zone",
      "#0f766e",
      "section",
      "#4f46e5",
      "#334155"
    ],
    "fill-opacity": 0.04
  };
}

export function buildAreaLabelLayout(): {
  "text-field": unknown[];
  "text-size": unknown[];
  "text-font": string[];
  "text-transform": "none";
  "text-allow-overlap": boolean;
  "text-ignore-placement": boolean;
  "text-optional": boolean;
} {
  return {
    "text-field": ["get", "name"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 15],
    "text-font": ["Noto Sans Regular"],
    "text-transform": "none",
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-optional": true
  };
}

export function buildAreaLabelPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": "#0f172a",
    "text-halo-color": "#f8fafc",
    "text-halo-width": 1.2,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1]
  };
}
