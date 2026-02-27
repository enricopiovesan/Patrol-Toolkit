import {
  buildAreaFillPaint,
  buildAreaLabelLayout,
  buildAreaLabelPaint,
  buildAreaLinePaint
} from "./area-style";

export const RESORT_AREAS_FILL_LAYER_ID = "resort-areas-fill";
export const RESORT_AREAS_LINE_LAYER_ID = "resort-areas-line";
export const RESORT_AREAS_LABEL_LAYER_ID = "resort-areas-label";
export const RESORT_AREAS_LABEL_LAYER_MIN_ZOOM = 12;
export const RESORT_AREAS_LABEL_FILTER = ["all", ["has", "name"], ["!=", ["get", "name"], ""]] as const;

export function buildAreaLayers(sourceId: string): {
  fillLayer: {
    id: string;
    type: "fill";
    source: string;
    paint: ReturnType<typeof buildAreaFillPaint>;
  };
  lineLayer: {
    id: string;
    type: "line";
    source: string;
    layout: {
      "line-join": "round";
      "line-cap": "round";
    };
    paint: ReturnType<typeof buildAreaLinePaint>;
  };
  labelLayer: {
    id: string;
    type: "symbol";
    source: string;
    minzoom: number;
    filter: readonly unknown[];
    layout: ReturnType<typeof buildAreaLabelLayout>;
    paint: ReturnType<typeof buildAreaLabelPaint>;
  };
} {
  return {
    fillLayer: {
      id: RESORT_AREAS_FILL_LAYER_ID,
      type: "fill",
      source: sourceId,
      paint: buildAreaFillPaint()
    },
    lineLayer: {
      id: RESORT_AREAS_LINE_LAYER_ID,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: buildAreaLinePaint()
    },
    labelLayer: {
      id: RESORT_AREAS_LABEL_LAYER_ID,
      type: "symbol",
      source: sourceId,
      minzoom: RESORT_AREAS_LABEL_LAYER_MIN_ZOOM,
      filter: RESORT_AREAS_LABEL_FILTER,
      layout: buildAreaLabelLayout(),
      paint: buildAreaLabelPaint()
    }
  };
}
