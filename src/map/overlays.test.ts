import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { buildResortOverlayData } from "./overlays";

describe("buildResortOverlayData", () => {
  it("builds runs and lifts overlays from pack geometry", () => {
    const pack = structuredClone(validPack) as ResortPack;
    const overlays = buildResortOverlayData(pack);

    expect(overlays.boundary.features).toHaveLength(0);
    expect(overlays.runs.features).toHaveLength(pack.runs.length);
    expect(overlays.runs.features[0]?.geometry.type).toBe("LineString");
    expect(overlays.runs.features[0]?.properties?.difficulty).toBe(pack.runs[0]?.difficulty);
    expect(overlays.lifts.features).toHaveLength(1);
    expect(overlays.liftTowers.features).toHaveLength(2);
  });

  it("builds boundary overlay when boundary is present", () => {
    const pack = structuredClone(validPack) as ResortPack;
    pack.boundary = {
      type: "Polygon",
      coordinates: [
        [
          [-106.952, 39.194],
          [-106.948, 39.194],
          [-106.948, 39.191],
          [-106.952, 39.194]
        ]
      ]
    };

    const overlays = buildResortOverlayData(pack);
    expect(overlays.boundary.features).toHaveLength(1);
    expect(overlays.boundary.features[0]?.geometry.type).toBe("Polygon");
  });

  it("returns empty collections when pack is missing", () => {
    const overlays = buildResortOverlayData(null);
    expect(overlays.boundary.features).toHaveLength(0);
    expect(overlays.runs.features).toHaveLength(0);
    expect(overlays.lifts.features).toHaveLength(0);
    expect(overlays.liftTowers.features).toHaveLength(0);
  });
});
