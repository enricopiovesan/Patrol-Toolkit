import { describe, expect, it } from "vitest";
import {
  RESORT_CONTOURS_MAJOR_FILTER,
  RESORT_CONTOURS_MAJOR_LINE_LAYER_ID,
  RESORT_CONTOURS_LABEL_FILTER,
  RESORT_CONTOURS_LABEL_LAYER_ID,
  RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM,
  RESORT_CONTOURS_MINOR_LABEL_FILTER,
  RESORT_CONTOURS_MINOR_LABEL_LAYER_ID,
  RESORT_CONTOURS_MINOR_LABEL_LAYER_MIN_ZOOM,
  RESORT_CONTOURS_MINOR_FILTER,
  RESORT_CONTOURS_MINOR_LINE_LAYER_ID,
  TERRAIN_RENDER_LAYER_ORDER_CONTRACT,
  buildContourLayers
} from "./contour-layers";

describe("contour-layers", () => {
  it("builds contour minor/major line layers and major/minor label layers", () => {
    const result = buildContourLayers("resort-contours");

    expect(result.minorLineLayer.id).toBe(RESORT_CONTOURS_MINOR_LINE_LAYER_ID);
    expect(result.minorLineLayer.type).toBe("line");
    expect(result.minorLineLayer.source).toBe("resort-contours");
    expect(result.minorLineLayer.filter).toEqual(RESORT_CONTOURS_MINOR_FILTER);

    expect(result.majorLineLayer.id).toBe(RESORT_CONTOURS_MAJOR_LINE_LAYER_ID);
    expect(result.majorLineLayer.type).toBe("line");
    expect(result.majorLineLayer.source).toBe("resort-contours");
    expect(result.majorLineLayer.filter).toEqual(RESORT_CONTOURS_MAJOR_FILTER);

    expect(result.labelLayer.id).toBe(RESORT_CONTOURS_LABEL_LAYER_ID);
    expect(result.labelLayer.type).toBe("symbol");
    expect(result.labelLayer.source).toBe("resort-contours");
    expect(result.labelLayer.minzoom).toBe(RESORT_CONTOURS_LABEL_LAYER_MIN_ZOOM);
    expect(result.labelLayer.filter).toEqual(RESORT_CONTOURS_LABEL_FILTER);

    expect(result.minorLabelLayer.id).toBe(RESORT_CONTOURS_MINOR_LABEL_LAYER_ID);
    expect(result.minorLabelLayer.type).toBe("symbol");
    expect(result.minorLabelLayer.source).toBe("resort-contours");
    expect(result.minorLabelLayer.minzoom).toBe(RESORT_CONTOURS_MINOR_LABEL_LAYER_MIN_ZOOM);
    expect(result.minorLabelLayer.filter).toEqual(RESORT_CONTOURS_MINOR_LABEL_FILTER);
  });

  it("exports terrain render order contract with terrain bands before areas and contours before peaks", () => {
    expect(TERRAIN_RENDER_LAYER_ORDER_CONTRACT).toEqual(["terrainBands", "areas", "contours", "peaks", "runs", "lifts"]);
  });
});
