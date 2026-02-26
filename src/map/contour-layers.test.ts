import { describe, expect, it } from "vitest";
import {
  RESORT_CONTOURS_LABEL_FILTER,
  RESORT_CONTOURS_LABEL_LAYER_ID,
  RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM,
  RESORT_CONTOURS_LINE_LAYER_ID,
  TERRAIN_RENDER_LAYER_ORDER_CONTRACT,
  buildContourLayers
} from "./contour-layers";

describe("contour-layers", () => {
  it("builds contour line and label layers", () => {
    const result = buildContourLayers("resort-contours");

    expect(result.lineLayer.id).toBe(RESORT_CONTOURS_LINE_LAYER_ID);
    expect(result.lineLayer.type).toBe("line");
    expect(result.lineLayer.source).toBe("resort-contours");

    expect(result.labelLayer.id).toBe(RESORT_CONTOURS_LABEL_LAYER_ID);
    expect(result.labelLayer.type).toBe("symbol");
    expect(result.labelLayer.source).toBe("resort-contours");
    expect(result.labelLayer.minzoom).toBe(RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM);
    expect(result.labelLayer.filter).toEqual(RESORT_CONTOURS_LABEL_FILTER);
  });

  it("exports terrain render order contract with contours between areas and peaks", () => {
    expect(TERRAIN_RENDER_LAYER_ORDER_CONTRACT).toEqual(["areas", "contours", "peaks", "runs", "lifts"]);
  });
});
