import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { buildResortOverlayData } from "./overlays";

describe("buildResortOverlayData", () => {
  it("maps runs and lifts from pack data", () => {
    const pack = structuredClone(validPack) as ResortPack;

    const data = buildResortOverlayData(pack);

    expect(data.boundary.features).toHaveLength(0);
    expect(data.runs.features).toHaveLength(pack.runs.length);
    expect(data.lifts.features).toHaveLength(pack.lifts.length);
    expect(data.liftTowers.features).toHaveLength(
      pack.lifts.reduce((total, lift) => total + lift.towers.length, 0)
    );
  });

  it("includes boundary when optional boundary polygon is present", () => {
    const pack = structuredClone(validPack) as ResortPack & { boundary?: GeoJSON.Polygon };
    pack.boundary = {
      type: "Polygon",
      coordinates: [
        [
          [-116.97, 51.28],
          [-116.95, 51.28],
          [-116.95, 51.3],
          [-116.97, 51.3],
          [-116.97, 51.28]
        ]
      ]
    };

    const data = buildResortOverlayData(pack);
    expect(data.boundary.features).toHaveLength(1);
  });
});
