import {
  TERRAIN_CONTOUR_COLORS,
  TERRAIN_CONTOUR_LABEL_FONT,
  TERRAIN_CONTOUR_LABEL_HALO_WIDTH,
  TERRAIN_CONTOUR_LABEL_MAX_ANGLE,
  TERRAIN_CONTOUR_LABEL_OPACITY_STOPS,
  TERRAIN_CONTOUR_LABEL_SIZE_STOPS,
  TERRAIN_CONTOUR_LABEL_SPACING,
  TERRAIN_CONTOUR_LINE_OPACITY_STOPS,
  TERRAIN_CONTOUR_LINE_WIDTH_STOPS,
  buildMajorContourFilterExpression
} from "./terrain-config";

export function buildContourLinePaint(): {
  "line-color": unknown[];
  "line-width": unknown[];
  "line-opacity": unknown[];
} {
  return {
    "line-color": [
      "case",
      buildMajorContourFilterExpression(),
      TERRAIN_CONTOUR_COLORS.major,
      TERRAIN_CONTOUR_COLORS.minor
    ],
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      ...TERRAIN_CONTOUR_LINE_WIDTH_STOPS
    ],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], ...TERRAIN_CONTOUR_LINE_OPACITY_STOPS]
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
    "symbol-spacing": TERRAIN_CONTOUR_LABEL_SPACING,
    "text-size": ["interpolate", ["linear"], ["zoom"], ...TERRAIN_CONTOUR_LABEL_SIZE_STOPS],
    "text-font": [...TERRAIN_CONTOUR_LABEL_FONT],
    "text-max-angle": TERRAIN_CONTOUR_LABEL_MAX_ANGLE
  };
}

export function buildContourLabelPaint(): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": TERRAIN_CONTOUR_COLORS.label,
    "text-halo-color": TERRAIN_CONTOUR_COLORS.labelHalo,
    "text-halo-width": TERRAIN_CONTOUR_LABEL_HALO_WIDTH,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], ...TERRAIN_CONTOUR_LABEL_OPACITY_STOPS]
  };
}
