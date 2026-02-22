export function buildLiftLineWidthExpression(): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 3.2, 16, 4.6];
}

export function buildLiftLinePaint(): {
  "line-color": string;
  "line-width": unknown[];
  "line-opacity": number;
} {
  return {
    "line-color": "#b91c1c",
    "line-width": buildLiftLineWidthExpression(),
    "line-opacity": 0.95
  };
}

export function buildLiftLabelLayout(): {
  "text-field": unknown[];
  "symbol-placement": "line";
  "symbol-spacing": number;
  "text-size": unknown[];
  "text-font": string[];
  "text-ignore-placement": boolean;
  "text-allow-overlap": boolean;
  "text-optional": boolean;
  "text-max-angle": number;
} {
  return {
    "text-field": ["get", "name"],
    "symbol-placement": "line",
    "symbol-spacing": 320,
    "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 14],
    "text-font": ["Noto Sans Regular"],
    "text-ignore-placement": false,
    "text-allow-overlap": false,
    "text-optional": true,
    "text-max-angle": 45
  };
}

export function buildLiftLabelPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": "#111827",
    "text-halo-color": "#fff7ed",
    "text-halo-width": 1.2,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 1]
  };
}

export function buildLiftTowerCirclePaint(): {
  "circle-color": string;
  "circle-radius": unknown[];
  "circle-stroke-color": string;
  "circle-stroke-width": number;
  "circle-opacity": unknown[];
} {
  return {
    "circle-color": "#7f1d1d",
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 3.5, 17, 4.5],
    "circle-stroke-color": "#fee2e2",
    "circle-stroke-width": 1,
    "circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.75, 15, 1]
  };
}

export function buildLiftTowerLabelLayout(): {
  "text-field": unknown[];
  "text-size": unknown[];
  "text-font": string[];
  "text-offset": number[];
  "text-anchor": "top";
  "text-ignore-placement": boolean;
  "text-allow-overlap": boolean;
} {
  return {
    "text-field": ["to-string", ["get", "towerNumber"]],
    "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9, 17, 11],
    "text-font": ["Noto Sans Regular"],
    "text-offset": [0, 1.1],
    "text-anchor": "top",
    "text-ignore-placement": false,
    "text-allow-overlap": false
  };
}

export function buildLiftTowerLabelPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": "#3f0d12",
    "text-halo-color": "#fff7ed",
    "text-halo-width": 1,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15, 1]
  };
}
