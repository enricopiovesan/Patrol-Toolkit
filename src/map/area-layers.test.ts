import { describe, expect, it } from "vitest";
import {
  buildAreaLayers,
  RESORT_AREAS_FILL_LAYER_ID,
  RESORT_AREAS_LABEL_FILTER,
  RESORT_AREAS_LABEL_LAYER_ID,
  RESORT_AREAS_LABEL_LAYER_MIN_ZOOM,
  RESORT_AREAS_LINE_LAYER_ID
} from "./area-layers";

describe("area layer specs", () => {
  it("builds deterministic area overlay layers", () => {
    const layers = buildAreaLayers("resort-areas");

    expect(layers.fillLayer.id).toBe(RESORT_AREAS_FILL_LAYER_ID);
    expect(layers.fillLayer.type).toBe("fill");
    expect(layers.fillLayer.source).toBe("resort-areas");
    expect(layers.fillLayer.paint["fill-opacity"]).toBe(0.04);

    expect(layers.lineLayer.id).toBe(RESORT_AREAS_LINE_LAYER_ID);
    expect(layers.lineLayer.type).toBe("line");
    expect(layers.lineLayer.source).toBe("resort-areas");
    expect(layers.lineLayer.paint["line-dasharray"]).toEqual([3, 2]);

    expect(layers.labelLayer.id).toBe(RESORT_AREAS_LABEL_LAYER_ID);
    expect(layers.labelLayer.type).toBe("symbol");
    expect(layers.labelLayer.source).toBe("resort-areas");
    expect(layers.labelLayer.minzoom).toBe(RESORT_AREAS_LABEL_LAYER_MIN_ZOOM);
    expect(layers.labelLayer.filter).toEqual(RESORT_AREAS_LABEL_FILTER);
    expect(layers.labelLayer.layout["text-field"]).toEqual(["get", "name"]);
  });
});
