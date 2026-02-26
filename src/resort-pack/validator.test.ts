import { describe, expect, it } from "vitest";
import invalidPack from "./fixtures/invalid-pack.json";
import validPack from "./fixtures/valid-pack.json";
import type { ResortPack } from "./types";
import { validateResortPack } from "./validator";

describe("validateResortPack", () => {
  it("accepts a valid resort pack", () => {
    const result = validateResortPack(validPack);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected validation success");
    }

    expect(result.value.resort.id).toBe("demo-resort");
  });

  it("returns structured errors for invalid resort packs", () => {
    const result = validateResortPack(invalidPack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation failure");
    }

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.code === "schema_violation")).toBe(true);
    expect(result.errors.some((error) => error.path.includes("/resort/id"))).toBe(true);
    expect(result.errors.some((error) => error.path.includes("/thresholds/liftProximityMeters"))).toBe(true);
  });

  it("rejects duplicate run ids", () => {
    const pack = clonePack();
    pack.runs.push({ ...pack.runs[0], name: "Copy Run" });

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.some(
        (error) => error.code === "duplicate_id" && error.path.includes("/runs/1/id")
      )
    ).toBe(true);
  });

  it("rejects duplicate lift ids", () => {
    const pack = clonePack();
    pack.lifts.push({ ...pack.lifts[0], name: "Copy Lift" });

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.some(
        (error) => error.code === "duplicate_id" && error.path.includes("/lifts/1/id")
      )
    ).toBe(true);
  });

  it("rejects duplicate tower numbers in a lift", () => {
    const pack = clonePack();
    const lift = pack.lifts[0];
    if (!lift) {
      throw new Error("Missing lift fixture");
    }
    lift.towers.push({
      number: 1,
      coordinates: [-106.949, 39.193]
    });

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(result.errors.some((error) => error.code === "duplicate_tower_number")).toBe(true);
  });

  it("rejects unclosed run polygon ring", () => {
    const pack = clonePack();
    const run = pack.runs[0];
    if (!run) {
      throw new Error("Missing run fixture");
    }
    run.polygon.coordinates[0] = [
      [-106.951, 39.193],
      [-106.95, 39.193],
      [-106.95, 39.192],
      [-106.951, 39.192]
    ];

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(result.errors.some((error) => error.code === "invalid_geometry")).toBe(true);
  });

  it("rejects centerline with duplicate consecutive points", () => {
    const pack = clonePack();
    const run = pack.runs[0];
    if (!run) {
      throw new Error("Missing run fixture");
    }
    run.centerline.coordinates = [
      [-106.9509, 39.1929],
      [-106.9509, 39.1929],
      [-106.9504, 39.1923]
    ];

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(result.errors.some((error) => error.code === "invalid_geometry")).toBe(true);
  });

  it("accepts optional boundary polygon", () => {
    const pack = clonePack();
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

    const result = validateResortPack(pack);
    expect(result.ok).toBe(true);
  });

  it("accepts optional named area perimeters", () => {
    const pack = clonePack();
    pack.areas = [
      {
        id: "bowl-1",
        name: "Terminator Bowl",
        kind: "bowl",
        perimeter: {
          type: "Polygon",
          coordinates: [
            [
              [-106.952, 39.194],
              [-106.948, 39.194],
              [-106.948, 39.191],
              [-106.952, 39.194]
            ]
          ]
        }
      }
    ];

    const result = validateResortPack(pack);
    expect(result.ok).toBe(true);
  });

  it("accepts optional terrain bands", () => {
    const pack = clonePack();
    pack.terrainBands = [
      {
        id: "tb-2200",
        elevationMinMeters: 2200,
        elevationMaxMeters: 2240,
        polygon: {
          type: "Polygon",
          coordinates: [
            [
              [-106.952, 39.194],
              [-106.948, 39.194],
              [-106.948, 39.191],
              [-106.952, 39.194]
            ]
          ]
        }
      }
    ];

    const result = validateResortPack(pack);
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate terrain band ids", () => {
    const pack = clonePack();
    pack.terrainBands = [
      {
        id: "tb-1",
        polygon: {
          type: "Polygon",
          coordinates: [[[-106.952, 39.194], [-106.948, 39.194], [-106.948, 39.191], [-106.952, 39.194]]]
        }
      },
      {
        id: "tb-1",
        polygon: {
          type: "Polygon",
          coordinates: [[[-106.952, 39.194], [-106.948, 39.194], [-106.948, 39.191], [-106.952, 39.194]]]
        }
      }
    ];
    const result = validateResortPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected semantic validation failure");
    expect(result.errors.some((error) => error.code === "duplicate_id" && error.path === "#/terrainBands/1/id")).toBe(true);
  });

  it("rejects unclosed terrain band polygon ring", () => {
    const pack = clonePack();
    pack.terrainBands = [
      {
        id: "tb-1",
        polygon: {
          type: "Polygon",
          coordinates: [[
            [-106.952, 39.194],
            [-106.948, 39.194],
            [-106.948, 39.191],
            [-106.952, 39.191]
          ]]
        }
      }
    ];
    const result = validateResortPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected semantic validation failure");
    expect(result.errors.some((error) => error.code === "invalid_geometry" && error.path === "#/terrainBands/0/polygon/coordinates/0")).toBe(true);
  });

  it("rejects duplicate area ids", () => {
    const pack = clonePack();
    pack.areas = [
      {
        id: "ridge-1",
        name: "Redemption Ridge",
        kind: "ridge",
        perimeter: {
          type: "Polygon",
          coordinates: [
            [
              [-106.952, 39.194],
              [-106.948, 39.194],
              [-106.948, 39.191],
              [-106.952, 39.194]
            ]
          ]
        }
      },
      {
        id: "ridge-1",
        name: "Other Ridge",
        kind: "ridge",
        perimeter: {
          type: "Polygon",
          coordinates: [
            [
              [-106.952, 39.194],
              [-106.948, 39.194],
              [-106.948, 39.191],
              [-106.952, 39.194]
            ]
          ]
        }
      }
    ];

    const result = validateResortPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }
    expect(result.errors.some((error) => error.code === "duplicate_id" && error.path === "#/areas/1/id")).toBe(true);
  });

  it("rejects duplicate peak ids", () => {
    const pack = clonePack();
    pack.peaks = [
      { id: "peak-1", name: "Terminator Peak", coordinates: [-106.95, 39.193], elevationMeters: 3500 },
      { id: "peak-1", name: "Other Peak", coordinates: [-106.949, 39.194] }
    ];
    const result = validateResortPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }
    expect(result.errors.some((error) => error.code === "duplicate_id" && error.path === "#/peaks/1/id")).toBe(true);
  });

  it("rejects unclosed area perimeter ring", () => {
    const pack = clonePack();
    pack.areas = [
      {
        id: "ridge-1",
        name: "Redemption Ridge",
        kind: "ridge",
        perimeter: {
          type: "Polygon",
          coordinates: [
            [
              [-106.952, 39.194],
              [-106.948, 39.194],
              [-106.948, 39.191],
              [-106.952, 39.191]
            ]
          ]
        }
      }
    ];

    const result = validateResortPack(pack);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }
    expect(
      result.errors.some(
        (error) => error.code === "invalid_geometry" && error.path === "#/areas/0/perimeter/coordinates/0"
      )
    ).toBe(true);
  });

  it("rejects unclosed boundary polygon ring", () => {
    const pack = clonePack();
    pack.boundary = {
      type: "Polygon",
      coordinates: [
        [
          [-106.952, 39.194],
          [-106.948, 39.194],
          [-106.948, 39.191],
          [-106.952, 39.191]
        ]
      ]
    };

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.some(
        (error) =>
          error.code === "invalid_geometry" && error.path === "#/boundary/coordinates/0"
      )
    ).toBe(true);
  });

  it("rejects invalid IANA timezone", () => {
    const pack = clonePack();
    pack.resort.timezone = "Mars/Olympus";

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.some(
        (error) => error.code === "invalid_timezone" && error.path === "#/resort/timezone"
      )
    ).toBe(true);
  });

  it("rejects network basemap paths", () => {
    const pack = clonePack();
    pack.basemap.pmtilesPath = "https://cdn.example.com/base.pmtiles";
    pack.basemap.stylePath = "http://cdn.example.com/style.json";

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.filter((error) => error.code === "offline_path_required").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("rejects path traversal in basemap paths", () => {
    const pack = clonePack();
    pack.basemap.pmtilesPath = "../private/base.pmtiles";
    pack.basemap.stylePath = "packs/../style.json";

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.filter((error) => error.code === "offline_path_required").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("rejects wrong basemap file extensions", () => {
    const pack = clonePack();
    pack.basemap.pmtilesPath = "packs/demo/base.mbtiles";
    pack.basemap.stylePath = "packs/demo/style.yaml";

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    expect(
      result.errors.some(
        (error) =>
          error.code === "offline_path_required" && error.path === "#/basemap/pmtilesPath"
      )
    ).toBe(true);
    expect(
      result.errors.some(
        (error) =>
          error.code === "offline_path_required" && error.path === "#/basemap/stylePath"
      )
    ).toBe(true);
  });

  it("returns semantic errors in deterministic sorted order", () => {
    const pack = clonePack();
    pack.basemap.pmtilesPath = "https://cdn.example.com/base.mbtiles";
    pack.basemap.stylePath = "../packs/demo/style.yaml";
    pack.resort.timezone = "Not/A_Zone";

    const result = validateResortPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected semantic validation failure");
    }

    const keys = result.errors.map((error) => `${error.path}|${error.code}`);
    const sortedKeys = [...keys].sort((left, right) => left.localeCompare(right));
    expect(keys).toEqual(sortedKeys);
  });
});

function clonePack(): ResortPack {
  return structuredClone(validPack) as ResortPack;
}
