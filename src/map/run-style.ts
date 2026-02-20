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
