export function buildContourLinePaint(): {
  "line-color": string;
  "line-width": unknown[];
  "line-opacity": unknown[];
} {
  return {
    "line-color": "#475569",
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 13, 0.9, 16, 1.4],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 12, 0.35, 15, 0.55]
  };
}

export function buildContourLabelLayout(): {
  "text-field": unknown[];
  "symbol-placement": "line";
  "symbol-spacing": number;
  "text-size": unknown[];
  "text-font": string[];
  "text-max-angle": number;
} {
  return {
    "text-field": [
      "case",
      ["has", "elevationMeters"],
      ["concat", ["to-string", ["get", "elevationMeters"]], "m"],
      ""
    ],
    "symbol-placement": "line",
    "symbol-spacing": 260,
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 11],
    "text-font": ["Noto Sans Regular"],
    "text-max-angle": 40
  };
}

export function buildContourLabelPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": "#334155",
    "text-halo-color": "#f8fafc",
    "text-halo-width": 1,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 0.65, 16, 0.8]
  };
}

