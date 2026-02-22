import type { RunDifficulty } from "../resort-pack/types";

export const RUN_DIFFICULTY_COLORS: Record<RunDifficulty, string> = {
  green: "#16a34a",
  blue: "#2563eb",
  black: "#111827",
  "double-black": "#7f1d1d"
};

export function buildRunLineColorExpression(): unknown[] {
  return [
    "match",
    ["get", "difficulty"],
    "green",
    RUN_DIFFICULTY_COLORS.green,
    "blue",
    RUN_DIFFICULTY_COLORS.blue,
    "black",
    RUN_DIFFICULTY_COLORS.black,
    "double-black",
    RUN_DIFFICULTY_COLORS["double-black"],
    "#475569"
  ];
}

export function buildRunLineWidthExpression(): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 10, 2, 13, 3, 16, 4.5];
}

export function buildRunLineDasharrayExpression(): unknown[] {
  return ["case", ["==", ["get", "difficulty"], "double-black"], ["literal", [2.4, 1.4]], ["literal", [1, 0]]];
}

export function buildRunLinePaint(): {
  "line-color": unknown[];
  "line-width": unknown[];
  "line-dasharray": unknown[];
  "line-opacity": number;
} {
  return {
    "line-color": buildRunLineColorExpression(),
    "line-width": buildRunLineWidthExpression(),
    "line-dasharray": buildRunLineDasharrayExpression(),
    "line-opacity": 0.94
  };
}

export function buildRunArrowLayout(): {
  "text-field": string;
  "symbol-placement": "line";
  "symbol-spacing": number;
  "text-size": unknown[];
  "text-font": string[];
  "text-keep-upright": boolean;
  "text-ignore-placement": boolean;
  "text-allow-overlap": boolean;
} {
  return {
    "text-field": "➜",
    "symbol-placement": "line",
    "symbol-spacing": 120,
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 13],
    "text-font": ["Noto Sans Regular"],
    "text-keep-upright": false,
    "text-ignore-placement": true,
    "text-allow-overlap": true
  };
}

export function buildRunArrowPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": "#111827",
    "text-halo-color": "#f8fafc",
    "text-halo-width": 0.9,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13, 0.75, 16, 0.9]
  };
}

export function buildRunLabelLayout(): {
  "text-field": unknown[];
  "symbol-placement": "line";
  "symbol-spacing": number;
  "text-size": unknown[];
  "text-font": string[];
  "text-allow-overlap": boolean;
  "text-ignore-placement": boolean;
  "text-optional": boolean;
  "text-max-angle": number;
} {
  return {
    "text-field": ["get", "name"],
    "symbol-placement": "line",
    "symbol-spacing": 300,
    "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13, 17, 15],
    "text-font": ["Noto Sans Regular"],
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-optional": true,
    "text-max-angle": 45
  };
}

export function buildRunLabelPaint(): {
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
