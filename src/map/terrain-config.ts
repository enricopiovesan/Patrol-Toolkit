export const TERRAIN_CONTOUR_MINOR_INTERVAL_METERS = 20;
export const TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS = 100;

export const TERRAIN_HYPSOMETRIC_COLOR_STOPS = [
  0, "#f6faf9",
  1400, "#f1f7fa",
  1800, "#edf4f9",
  2200, "#f5f8fc",
  2800, "#ffffff"
] as const;
export const TERRAIN_HYPSOMETRIC_FILL_OPACITY = 0.22;
export const TERRAIN_FAUX_SHADING_INTENSITY = 1.65;
export const TERRAIN_FAUX_SHADING_BAND_INTERVAL_METERS = TERRAIN_CONTOUR_MINOR_INTERVAL_METERS;
export const TERRAIN_FAUX_SHADING_BAND_CYCLE_COUNT = 4;
export const TERRAIN_FAUX_SHADING_DARK_COLOR = "#5d7185";
export const TERRAIN_FAUX_SHADING_LIGHT_COLOR = "#ffffff";
export const TERRAIN_FAUX_SHADING_DARK_OPACITY_STOPS = [
  11, 0,
  12, 0.05,
  14, 0.08,
  16, 0.095
] as const;
export const TERRAIN_FAUX_SHADING_LIGHT_OPACITY_STOPS = [
  11, 0,
  12, 0.04,
  14, 0.07,
  16, 0.085
] as const;

export const TERRAIN_CONTOUR_COLORS = {
  major: "#6f8faa",
  minor: "#9fb4c6",
  label: "#7f8f9b",
  labelHalo: "#f6fbff"
} as const;
export const TERRAIN_CONTOUR_MINOR_LINE_BLUR = 0.35;
export const TERRAIN_CONTOUR_MAJOR_LINE_BLUR = 0.2;

export const TERRAIN_CONTOUR_MINOR_LINE_WIDTH_STOPS = [
  11, 0.75,
  13, 1.05,
  16, 1.3
] as const;

export const TERRAIN_CONTOUR_MAJOR_LINE_WIDTH_STOPS = [
  11, 0.95,
  13, 1.25,
  16, 1.75
] as const;

export const TERRAIN_CONTOUR_MINOR_LINE_OPACITY_STOPS = [
  10.5, 0,
  12, 0.24,
  15, 0.34
] as const;

export const TERRAIN_CONTOUR_MAJOR_LINE_OPACITY_STOPS = [
  10.5, 0,
  12, 0.34,
  15, 0.5
] as const;

export const TERRAIN_CONTOUR_LABEL_MIN_ZOOM = 13;
export const TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM = 15;
export const TERRAIN_CONTOUR_MAJOR_LABEL_SPACING = 340;
export const TERRAIN_CONTOUR_MINOR_LABEL_SPACING = 420;
export const TERRAIN_CONTOUR_LABEL_FONT = ["Noto Sans Regular"] as const;
export const TERRAIN_CONTOUR_LABEL_MAX_ANGLE = 40;
export const TERRAIN_CONTOUR_MAJOR_LABEL_SIZE_STOPS = [13, 10, 16, 11] as const;
export const TERRAIN_CONTOUR_MINOR_LABEL_SIZE_STOPS = [15, 9.5, 17, 10] as const;
export const TERRAIN_CONTOUR_MAJOR_LABEL_OPACITY_STOPS = [12.5, 0, 13.5, 0.52, 16, 0.62] as const;
export const TERRAIN_CONTOUR_MINOR_LABEL_OPACITY_STOPS = [14.8, 0, 15.4, 0.3, 17, 0.4] as const;
export const TERRAIN_CONTOUR_MAJOR_LABEL_HALO_WIDTH = 1.6;
export const TERRAIN_CONTOUR_MINOR_LABEL_HALO_WIDTH = 1.35;
export const TERRAIN_CONTOUR_LABEL_PADDING = 2;

export const TERRAIN_PEAK_MARKER_MIN_ZOOM = 10;
export const TERRAIN_PEAK_LABEL_MIN_ZOOM = 11;
export const TERRAIN_PEAK_LABEL_ELEVATION_DETAIL_MIN_ZOOM = 13;
export const TERRAIN_PEAK_LABEL_FONT = ["Open Sans Semibold", "Arial Unicode MS Bold"] as const;
export const TERRAIN_PEAK_LABEL_SIZE_STOPS = [11, 10, 15, 12, 17, 13] as const;
export const TERRAIN_PEAK_LABEL_COLOR = "#111827";
export const TERRAIN_PEAK_LABEL_HALO_COLOR = "#f8fafc";
export const TERRAIN_PEAK_LABEL_HALO_WIDTH = 1.4;
export const TERRAIN_PEAK_LABEL_RADIAL_OFFSET = 0.9;
export const TERRAIN_PEAK_LABEL_VARIABLE_ANCHORS = ["top", "top-right", "top-left", "right", "left", "bottom"] as const;

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
