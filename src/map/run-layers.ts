import { buildRunLabelLayout, buildRunLabelPaint, buildRunLinePaint } from "./run-style";

export const RESORT_RUNS_LINE_LAYER_ID = "resort-runs-line";
export const RESORT_RUNS_LABEL_LAYER_ID = "resort-runs-label";

export function buildRunLayers(sourceId: string): {
  lineLayer: {
    id: string;
    type: "line";
    source: string;
    paint: ReturnType<typeof buildRunLinePaint>;
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
    labelLayer: {
      id: RESORT_RUNS_LABEL_LAYER_ID,
      type: "symbol",
      source: sourceId,
      layout: buildRunLabelLayout(),
      paint: buildRunLabelPaint()
    }
  };
}
