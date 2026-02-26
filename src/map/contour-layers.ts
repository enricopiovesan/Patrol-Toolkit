import { buildContourLabelLayout, buildContourLabelPaint, buildContourLinePaint } from "./contour-style";

export const RESORT_CONTOURS_LINE_LAYER_ID = "resort-contours-line";
export const RESORT_CONTOURS_LABEL_LAYER_ID = "resort-contours-label";
export const RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM = 13;
export const RESORT_CONTOURS_LABEL_FILTER = ["all", ["has", "elevationMeters"]] as const;

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

