import {
  TERRAIN_CONTOUR_COLORS,
  TERRAIN_CONTOUR_LABEL_FONT,
  TERRAIN_CONTOUR_LABEL_PADDING,
  TERRAIN_CONTOUR_LABEL_MAX_ANGLE,
  TERRAIN_CONTOUR_MAJOR_LABEL_HALO_WIDTH,
  TERRAIN_CONTOUR_MAJOR_LABEL_OPACITY_STOPS,
  TERRAIN_CONTOUR_MAJOR_LABEL_SIZE_STOPS,
  TERRAIN_CONTOUR_MAJOR_LABEL_SPACING,
  TERRAIN_CONTOUR_MINOR_LABEL_HALO_WIDTH,
  TERRAIN_CONTOUR_MINOR_LABEL_OPACITY_STOPS,
  TERRAIN_CONTOUR_MINOR_LABEL_SIZE_STOPS,
  TERRAIN_CONTOUR_MINOR_LABEL_SPACING,
  TERRAIN_CONTOUR_MAJOR_LINE_OPACITY_STOPS,
  TERRAIN_CONTOUR_MAJOR_LINE_WIDTH_STOPS,
  TERRAIN_CONTOUR_MINOR_LINE_OPACITY_STOPS,
  TERRAIN_CONTOUR_MINOR_LINE_WIDTH_STOPS
} from "./terrain-config";

function buildContourLinePaint(color: string, widthStops: readonly number[], opacityStops: readonly number[]): {
  "line-color": string;
  "line-width": unknown[];
  "line-opacity": unknown[];
} {
  return {
    "line-color": color,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      ...widthStops
    ],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], ...opacityStops]
  };
}

export function buildContourMinorLinePaint(): {
  "line-color": string;
  "line-width": unknown[];
  "line-opacity": unknown[];
} {
  return buildContourLinePaint(
    TERRAIN_CONTOUR_COLORS.minor,
    TERRAIN_CONTOUR_MINOR_LINE_WIDTH_STOPS,
    TERRAIN_CONTOUR_MINOR_LINE_OPACITY_STOPS
  );
}

export function buildContourMajorLinePaint(): {
  "line-color": string;
  "line-width": unknown[];
  "line-opacity": unknown[];
} {
  return buildContourLinePaint(
    TERRAIN_CONTOUR_COLORS.major,
    TERRAIN_CONTOUR_MAJOR_LINE_WIDTH_STOPS,
    TERRAIN_CONTOUR_MAJOR_LINE_OPACITY_STOPS
  );
}

type ContourLabelVariant = "major" | "minor";

export function buildContourLabelLayout(variant: ContourLabelVariant = "major"): {
  "text-field": unknown[];
  "symbol-placement": "line";
  "symbol-spacing": number;
  "text-size": unknown[];
  "text-font": string[];
  "text-max-angle": number;
  "text-keep-upright": boolean;
  "text-padding": number;
} {
  return {
    "text-field": [
      "case",
      ["has", "elevationMeters"],
      ["concat", ["to-string", ["get", "elevationMeters"]], "m"],
      ""
    ],
    "symbol-placement": "line",
    "symbol-spacing": variant === "major" ? TERRAIN_CONTOUR_MAJOR_LABEL_SPACING : TERRAIN_CONTOUR_MINOR_LABEL_SPACING,
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      ...(variant === "major" ? TERRAIN_CONTOUR_MAJOR_LABEL_SIZE_STOPS : TERRAIN_CONTOUR_MINOR_LABEL_SIZE_STOPS)
    ],
    "text-font": [...TERRAIN_CONTOUR_LABEL_FONT],
    "text-max-angle": TERRAIN_CONTOUR_LABEL_MAX_ANGLE,
    "text-keep-upright": true,
    "text-padding": TERRAIN_CONTOUR_LABEL_PADDING
  };
}

export function buildContourLabelPaint(variant: ContourLabelVariant = "major"): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-opacity": unknown[];
} {
  return {
    "text-color": TERRAIN_CONTOUR_COLORS.label,
    "text-halo-color": TERRAIN_CONTOUR_COLORS.labelHalo,
    "text-halo-width": variant === "major" ? TERRAIN_CONTOUR_MAJOR_LABEL_HALO_WIDTH : TERRAIN_CONTOUR_MINOR_LABEL_HALO_WIDTH,
    "text-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      ...(variant === "major" ? TERRAIN_CONTOUR_MAJOR_LABEL_OPACITY_STOPS : TERRAIN_CONTOUR_MINOR_LABEL_OPACITY_STOPS)
    ]
  };
}
