import { buildContourLabelLayout, buildContourLabelPaint, buildContourLinePaint } from "./contour-style";
import {
  TERRAIN_CONTOUR_LABEL_MIN_ZOOM,
  TERRAIN_OVERLAY_LAYER_ORDER,
  buildContourLabelFilterExpression
} from "./terrain-config";

export const RESORT_CONTOURS_LINE_LAYER_ID = "resort-contours-line";
export const RESORT_CONTOURS_LABEL_LAYER_ID = "resort-contours-label";
export const RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM = TERRAIN_CONTOUR_LABEL_MIN_ZOOM;
export const RESORT_CONTOURS_LABEL_FILTER = buildContourLabelFilterExpression() as readonly unknown[];
export const TERRAIN_RENDER_LAYER_ORDER_CONTRACT = [...TERRAIN_OVERLAY_LAYER_ORDER] as const;

export function buildContourLayers(sourceId: string): {
  lineLayer: {
    id: string;
    type: "line";
    source: string;
    paint: ReturnType<typeof buildContourLinePaint>;
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
    lineLayer: {
      id: RESORT_CONTOURS_LINE_LAYER_ID,
      type: "line",
      source: sourceId,
      paint: buildContourLinePaint()
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
