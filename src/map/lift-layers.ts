import {
  buildLiftLabelLayout,
  buildLiftLabelPaint,
  buildLiftLinePaint,
  buildLiftTowerCirclePaint,
  buildLiftTowerLabelLayout,
  buildLiftTowerLabelPaint
} from "./lift-style";

export const RESORT_LIFTS_LINE_LAYER_ID = "resort-lifts-line";
export const RESORT_LIFTS_LABEL_LAYER_ID = "resort-lifts-label";
export const RESORT_LIFT_TOWERS_CIRCLE_LAYER_ID = "resort-lift-towers";
export const RESORT_LIFT_TOWERS_LABEL_LAYER_ID = "resort-lift-tower-labels";

export function buildLiftLayers(
  liftSourceId: string,
  towerSourceId: string
): {
  lineLayer: {
    id: string;
    type: "line";
    source: string;
    paint: ReturnType<typeof buildLiftLinePaint>;
  };
  labelLayer: {
    id: string;
    type: "symbol";
    source: string;
    layout: ReturnType<typeof buildLiftLabelLayout>;
    paint: ReturnType<typeof buildLiftLabelPaint>;
  };
  towerCircleLayer: {
    id: string;
    type: "circle";
    source: string;
    paint: ReturnType<typeof buildLiftTowerCirclePaint>;
  };
  towerLabelLayer: {
    id: string;
    type: "symbol";
    source: string;
    layout: ReturnType<typeof buildLiftTowerLabelLayout>;
    paint: ReturnType<typeof buildLiftTowerLabelPaint>;
  };
} {
  return {
    lineLayer: {
      id: RESORT_LIFTS_LINE_LAYER_ID,
      type: "line",
      source: liftSourceId,
      paint: buildLiftLinePaint()
    },
    labelLayer: {
      id: RESORT_LIFTS_LABEL_LAYER_ID,
      type: "symbol",
      source: liftSourceId,
      layout: buildLiftLabelLayout(),
      paint: buildLiftLabelPaint()
    },
    towerCircleLayer: {
      id: RESORT_LIFT_TOWERS_CIRCLE_LAYER_ID,
      type: "circle",
      source: towerSourceId,
      paint: buildLiftTowerCirclePaint()
    },
    towerLabelLayer: {
      id: RESORT_LIFT_TOWERS_LABEL_LAYER_ID,
      type: "symbol",
      source: towerSourceId,
      layout: buildLiftTowerLabelLayout(),
      paint: buildLiftTowerLabelPaint()
    }
  };
}
