import {
  buildRunArrowLayout,
  buildRunArrowPaint,
  buildRunLabelLayout,
  buildRunLabelPaint,
  buildRunLinePaint
} from "./run-style";

export const RESORT_RUNS_LINE_LAYER_ID = "resort-runs-line";
export const RESORT_RUNS_ARROW_LAYER_ID = "resort-runs-arrow";
export const RESORT_RUNS_LABEL_LAYER_ID = "resort-runs-label";
export const RESORT_RUNS_ARROW_FILTER = [
  "match",
  ["get", "difficulty"],
  "green",
  true,
  "blue",
  true,
  "black",
  true,
  "double-black",
  true,
  false
] as const;

export function buildRunLayers(sourceId: string): {
  lineLayer: {
    id: string;
    type: "line";
    source: string;
    paint: ReturnType<typeof buildRunLinePaint>;
  };
  arrowLayer: {
    id: string;
    type: "symbol";
    source: string;
    filter: readonly unknown[];
    layout: ReturnType<typeof buildRunArrowLayout>;
    paint: ReturnType<typeof buildRunArrowPaint>;
  };
  labelLayer: {
    id: string;
    type: "symbol";
    source: string;
    layout: ReturnType<typeof buildRunLabelLayout>;
    paint: ReturnType<typeof buildRunLabelPaint>;
  };
} {
  return {
    lineLayer: {
      id: RESORT_RUNS_LINE_LAYER_ID,
      type: "line",
      source: sourceId,
      paint: buildRunLinePaint()
    },
    arrowLayer: {
      id: RESORT_RUNS_ARROW_LAYER_ID,
      type: "symbol",
      source: sourceId,
      filter: RESORT_RUNS_ARROW_FILTER,
      layout: buildRunArrowLayout(),
      paint: buildRunArrowPaint()
    },
    labelLayer: {
      id: RESORT_RUNS_LABEL_LAYER_ID,
      type: "symbol",
      source: sourceId,
      layout: buildRunLabelLayout(),
      paint: buildRunLabelPaint()
    }
  };
}
