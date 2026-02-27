import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { buildResortOverlayData } from "./overlays";

describe("buildResortOverlayData", () => {
  it("builds runs and lifts overlays from pack geometry", () => {
    const pack = structuredClone(validPack) as ResortPack;
    pack.areas = [
      {
        id: "ridge-1",
        name: "Redemption Ridge",
        kind: "ridge",
        perimeter: {
          type: "Polygon",
          coordinates: [
            [
              [-106.951, 39.193],
              [-106.95, 39.193],
              [-106.95, 39.192],
              [-106.951, 39.193]
            ]
          ]
        }
      }
    ];
    pack.contours = [
      {
        id: "contour-1",
        elevationMeters: 2300,
        line: {
          type: "LineString",
          coordinates: [
            [-106.951, 39.193],
            [-106.95, 39.1925]
          ]
        }
      }
    ];
    pack.terrainBands = [
      {
        id: "tb-1",
        elevationMinMeters: 2200,
        elevationMaxMeters: 2240,
        polygon: {
          type: "Polygon",
          coordinates: [[
            [-106.9512, 39.1932],
            [-106.9498, 39.1932],
            [-106.9498, 39.1922],
            [-106.9512, 39.1932]
          ]]
        }
      }
    ];
    pack.peaks = [
      {
        id: "peak-1",
        name: "Terminator Peak",
        coordinates: [-106.9502, 39.1931],
        elevationMeters: 3480
      }
    ];
    pack.runs = [
      {
        id: "run-1",
        name: "Flying Dutchman",
        difficulty: "black",
        polygon: {
          type: "Polygon",
          coordinates: [[
            [-106.952, 39.1934],
            [-106.9495, 39.1934],
            [-106.9495, 39.1924],
            [-106.952, 39.1934]
          ]]
        },
        centerline: {
          type: "LineString",
          coordinates: [
            [-106.9518, 39.1932],
            [-106.9509, 39.1932],
            [-106.9502, 39.1927],
            [-106.9497, 39.1925]
          ]
        }
      }
    ];
    const overlays = buildResortOverlayData(pack);

    expect(overlays.boundary.features).toHaveLength(0);
    expect(overlays.terrainBands.features).toHaveLength(1);
    expect(overlays.terrainBands.features[0]?.properties?.elevationMidMeters).toBe(2220);
    expect(overlays.areas.features).toHaveLength(1);
    expect(overlays.areas.features[0]?.properties?.kind).toBe("ridge");
    expect(overlays.contours.features).toHaveLength(1);
    expect(overlays.peaks.features).toHaveLength(1);
    expect(overlays.runs.features).toHaveLength(pack.runs.length);
    expect(overlays.runs.features[0]?.geometry.type).toBe("LineString");
    expect(overlays.runs.features[0]?.properties?.difficulty).toBe(pack.runs[0]?.difficulty);
    expect(
      (overlays.runs.features[0]?.geometry.coordinates.length ?? 0) >
        (pack.runs[0]?.centerline.coordinates.length ?? 0)
    ).toBe(true);
    expect(overlays.lifts.features).toHaveLength(1);
    expect(overlays.liftTowers.features).toHaveLength(2);
    expect(
      (overlays.areas.features[0]?.geometry.coordinates[0]?.length ?? 0) >
        (pack.areas?.[0]?.perimeter.coordinates[0]?.length ?? 0)
    ).toBe(true);
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
    expect(overlays.terrainBands.features).toHaveLength(0);
    expect(overlays.boundary.features[0]?.geometry.type).toBe("Polygon");
  });

  it("returns empty collections when pack is missing", () => {
    const overlays = buildResortOverlayData(null);
    expect(overlays.boundary.features).toHaveLength(0);
    expect(overlays.terrainBands.features).toHaveLength(0);
    expect(overlays.areas.features).toHaveLength(0);
    expect(overlays.contours.features).toHaveLength(0);
    expect(overlays.peaks.features).toHaveLength(0);
    expect(overlays.runs.features).toHaveLength(0);
    expect(overlays.lifts.features).toHaveLength(0);
    expect(overlays.liftTowers.features).toHaveLength(0);
  });
});
