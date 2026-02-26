export const TERRAIN_CONTOUR_MINOR_INTERVAL_METERS = 20;
export const TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS = 100;

export const TERRAIN_HYPSOMETRIC_COLOR_STOPS = [
  0, "#dfead8",
  1400, "#d7e3cf",
  1800, "#d8d2bc",
  2200, "#e6dec8",
  2800, "#f2eadb"
] as const;
export const TERRAIN_HYPSOMETRIC_FILL_OPACITY = 0.22;
export const TERRAIN_FAUX_SHADING_INTENSITY = 1.1;
export const TERRAIN_FAUX_SHADING_BAND_INTERVAL_METERS = TERRAIN_CONTOUR_MINOR_INTERVAL_METERS;
export const TERRAIN_FAUX_SHADING_BAND_CYCLE_COUNT = 4;
export const TERRAIN_FAUX_SHADING_DARK_COLOR = "#6f5a45";
export const TERRAIN_FAUX_SHADING_LIGHT_COLOR = "#fff8ea";
export const TERRAIN_FAUX_SHADING_DARK_OPACITY_STOPS = [
  11, 0,
  12, 0.02,
  14, 0.035,
  16, 0.045
] as const;
export const TERRAIN_FAUX_SHADING_LIGHT_OPACITY_STOPS = [
  11, 0,
  12, 0.015,
  14, 0.026,
  16, 0.034
] as const;

export const TERRAIN_CONTOUR_COLORS = {
  major: "#6b4f3a",
  minor: "#8f735f",
  label: "#5b4637",
  labelHalo: "#f6f1ea"
} as const;

export const TERRAIN_CONTOUR_MINOR_LINE_WIDTH_STOPS = [
  11, 0.8,
  13, 1.05,
  16, 1.35
] as const;

export const TERRAIN_CONTOUR_MAJOR_LINE_WIDTH_STOPS = [
  11, 1.0,
  13, 1.35,
  16, 2.0
] as const;

export const TERRAIN_CONTOUR_MINOR_LINE_OPACITY_STOPS = [
  10.5, 0,
  12, 0.13,
  15, 0.2
] as const;

export const TERRAIN_CONTOUR_MAJOR_LINE_OPACITY_STOPS = [
  10.5, 0,
  12, 0.22,
  15, 0.34
] as const;

export const TERRAIN_CONTOUR_LABEL_MIN_ZOOM = 13;
export const TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM = 15;
export const TERRAIN_CONTOUR_LABEL_SPACING = 320;
export const TERRAIN_CONTOUR_LABEL_FONT = ["Noto Sans Regular"] as const;
export const TERRAIN_CONTOUR_LABEL_MAX_ANGLE = 40;
export const TERRAIN_CONTOUR_LABEL_SIZE_STOPS = [13, 10, 16, 11] as const;
export const TERRAIN_CONTOUR_LABEL_OPACITY_STOPS = [12.5, 0, 13.5, 0.28, 16, 0.34] as const;
export const TERRAIN_CONTOUR_LABEL_HALO_WIDTH = 1.2;

export const TERRAIN_OVERLAY_LAYER_ORDER = [
  "terrainBands",
  "areas",
  "contours",
  "peaks",
  "runs",
  "lifts"
] as const;

export type TerrainOverlayLayerGroup = (typeof TERRAIN_OVERLAY_LAYER_ORDER)[number];

export function isMajorContourElevationMeters(value: unknown): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  return value % TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS === 0;
}

export function buildMajorContourFilterExpression(): unknown[] {
  return [
    "all",
    ["has", "elevationMeters"],
    ["==", ["%", ["to-number", ["get", "elevationMeters"]], TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS], 0]
  ];
}

export function buildContourLabelFilterExpression(): unknown[] {
  return buildMajorContourFilterExpression();
}
