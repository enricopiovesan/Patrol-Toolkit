export const TERRAIN_CONTOUR_MINOR_INTERVAL_METERS = 20;
export const TERRAIN_CONTOUR_MAJOR_INTERVAL_METERS = 100;

export const TERRAIN_CONTOUR_COLORS = {
  major: "#334155",
  minor: "#64748b",
  label: "#1f2937",
  labelHalo: "#f8fafc"
} as const;

export const TERRAIN_CONTOUR_LINE_WIDTH_STOPS = [
  11, 0.8,
  13, 1.05,
  16, 1.6
] as const;

export const TERRAIN_CONTOUR_LINE_OPACITY_STOPS = [
  10.5, 0,
  12, 0.275,
  15, 0.41
] as const;

export const TERRAIN_CONTOUR_LABEL_MIN_ZOOM = 13;
export const TERRAIN_CONTOUR_LABEL_SPACING = 260;
export const TERRAIN_CONTOUR_LABEL_FONT = ["Noto Sans Regular"] as const;
export const TERRAIN_CONTOUR_LABEL_MAX_ANGLE = 40;
export const TERRAIN_CONTOUR_LABEL_SIZE_STOPS = [13, 10, 16, 11] as const;
export const TERRAIN_CONTOUR_LABEL_OPACITY_STOPS = [12.5, 0, 13.5, 0.375, 16, 0.45] as const;
export const TERRAIN_CONTOUR_LABEL_HALO_WIDTH = 1.2;

export const TERRAIN_OVERLAY_LAYER_ORDER = [
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
  return ["all", ["has", "elevationMeters"]];
}

