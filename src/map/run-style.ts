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

export function buildRunLinePaint(): {
  "line-color": unknown[];
  "line-width": unknown[];
  "line-opacity": number;
} {
  return {
    "line-color": buildRunLineColorExpression(),
    "line-width": buildRunLineWidthExpression(),
    "line-opacity": 0.94
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
