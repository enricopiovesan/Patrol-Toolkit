import {
  buildContourLabelLayout,
  buildContourLabelPaint,
  buildContourMajorLinePaint,
  buildContourMinorLinePaint
} from "./contour-style";
import {
  TERRAIN_CONTOUR_LABEL_MIN_ZOOM,
  TERRAIN_OVERLAY_LAYER_ORDER,
  buildMajorContourFilterExpression,
  buildContourLabelFilterExpression
} from "./terrain-config";

export const RESORT_CONTOURS_MINOR_LINE_LAYER_ID = "resort-contours-line-minor";
export const RESORT_CONTOURS_MAJOR_LINE_LAYER_ID = "resort-contours-line-major";
export const RESORT_CONTOURS_LABEL_LAYER_ID = "resort-contours-label";
export const RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM = TERRAIN_CONTOUR_LABEL_MIN_ZOOM;
export const RESORT_CONTOURS_MAJOR_FILTER = buildMajorContourFilterExpression() as readonly unknown[];
export const RESORT_CONTOURS_MINOR_FILTER = [
  "all",
  ["has", "elevationMeters"],
  ["!", RESORT_CONTOURS_MAJOR_FILTER]
] as const;
export const RESORT_CONTOURS_LABEL_FILTER = buildContourLabelFilterExpression() as readonly unknown[];
export const TERRAIN_RENDER_LAYER_ORDER_CONTRACT = [...TERRAIN_OVERLAY_LAYER_ORDER] as const;

export function buildContourLayers(sourceId: string): {
  minorLineLayer: {
    id: string;
    type: "line";
    source: string;
    filter: readonly unknown[];
    paint: ReturnType<typeof buildContourMinorLinePaint>;
  };
  majorLineLayer: {
    id: string;
    type: "line";
    source: string;
    filter: readonly unknown[];
    paint: ReturnType<typeof buildContourMajorLinePaint>;
  };
  labelLayer: {
    id: string;
    type: "symbol";
    source: string;
    minzoom: number;
    filter: readonly unknown[];
    layout: ReturnType<typeof buildContourLabelLayout>;
    paint: ReturnType<typeof buildContourLabelPaint>;
  };
} {
  return {
    minorLineLayer: {
      id: RESORT_CONTOURS_MINOR_LINE_LAYER_ID,
      type: "line",
      source: sourceId,
      filter: RESORT_CONTOURS_MINOR_FILTER,
      paint: buildContourMinorLinePaint()
    },
    majorLineLayer: {
      id: RESORT_CONTOURS_MAJOR_LINE_LAYER_ID,
      type: "line",
      source: sourceId,
      filter: RESORT_CONTOURS_MAJOR_FILTER,
      paint: buildContourMajorLinePaint()
    },
    labelLayer: {
      id: RESORT_CONTOURS_LABEL_LAYER_ID,
      type: "symbol",
      source: sourceId,
      minzoom: RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM,
      filter: RESORT_CONTOURS_LABEL_FILTER,
      layout: buildContourLabelLayout(),
      paint: buildContourLabelPaint()
    }
  };
}
