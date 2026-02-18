import { describe, expect, it } from "vitest";
import type { NormalizedResortSource } from "./osm-normalized-types.js";
import { buildPackFromNormalized } from "./pack-build.js";

function createNormalizedFixture(): NormalizedResortSource {
  return {
    schemaVersion: "0.2.0",
    resort: {
      id: "demo-resort",
      name: "Demo Resort"
    },
    source: {
      format: "osm-overpass-json",
      sha256: "abc123",
      inputPath: "demo.osm.json",
      osmBaseTimestamp: "2026-02-18T10:00:00Z"
    },
    boundary: {
      source: "relation",
      sourceId: 901,
      polygon: {
        type: "Polygon",
        coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]
      }
    },
    lifts: [
      {
        id: "lift-way-1",
        name: "Chair 1",
        kind: "chair_lift",
        sourceWayId: 1,
        line: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.2, 0.2]
          ]
        },
        towers: [
          { number: 1, coordinates: [0, 0] },
          { number: 2, coordinates: [0.2, 0.2] }
        ]
      }
    ],
    runs: [
      {
        id: "run-way-2",
        name: "Bluebird",
        difficulty: "intermediate",
        sourceWayId: 2,
        centerline: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.4, 0.4]
          ]
        }
      }
    ],
    warnings: []
  };
}

describe("buildPackFromNormalized", () => {
  it("builds a valid pack and report when entities are inside boundary", () => {
    const normalized = createNormalizedFixture();

    const result = buildPackFromNormalized(normalized, {
      inputPath: "normalized.json",
      timezone: "Europe/Rome",
      pmtilesPath: "packs/demo/base.pmtiles",
      stylePath: "packs/demo/style.json"
    });

    expect(result.pack.resort.id).toBe("demo-resort");
    expect(result.pack.resort.timezone).toBe("Europe/Rome");
    expect(result.pack.runs).toHaveLength(1);
    expect(result.pack.runs[0]?.difficulty).toBe("blue");
    expect(result.pack.runs[0]?.polygon.type).toBe("Polygon");
    expect(result.pack.runs[0]?.polygon.coordinates[0].length).toBeGreaterThanOrEqual(4);
    expect(result.report.boundaryGate.status).toBe("passed");
    expect(result.report.boundaryGate.issues).toEqual([]);
    expect(result.report.generatedAt).toBe("2026-02-18T10:00:00.000Z");
  });

  it("fails boundary gate when a run is outside the boundary", () => {
    const normalized = createNormalizedFixture();
    normalized.runs[0] = {
      ...normalized.runs[0],
      centerline: {
        type: "LineString",
        coordinates: [
          [2, 2],
          [2.2, 2.2]
        ]
      }
    };

    expect(() =>
      buildPackFromNormalized(normalized, {
        inputPath: "normalized.json",
        timezone: "Europe/Rome",
        pmtilesPath: "packs/demo/base.pmtiles",
        stylePath: "packs/demo/style.json"
      })
    ).toThrow(/Boundary gate failed/);
  });

  it("can bypass failed boundary gate with explicit override", () => {
    const normalized = createNormalizedFixture();
    normalized.lifts[0] = {
      ...normalized.lifts[0],
      towers: [
        { number: 1, coordinates: [3, 3] },
        { number: 2, coordinates: [3.2, 3.2] }
      ]
    };

    const result = buildPackFromNormalized(normalized, {
      inputPath: "normalized.json",
      timezone: "Europe/Rome",
      pmtilesPath: "packs/demo/base.pmtiles",
      stylePath: "packs/demo/style.json",
      allowOutsideBoundary: true
    });

    expect(result.report.boundaryGate.status).toBe("failed");
    expect(result.report.boundaryGate.issues[0]?.entityType).toBe("lift");
  });

  it("allows explicit generatedAt override for deterministic reporting", () => {
    const normalized = createNormalizedFixture();
    const result = buildPackFromNormalized(normalized, {
      inputPath: "normalized.json",
      timezone: "Europe/Rome",
      pmtilesPath: "packs/demo/base.pmtiles",
      stylePath: "packs/demo/style.json",
      generatedAt: "2026-03-01T00:00:00.000Z"
    });

    expect(result.report.generatedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("fails fast on invalid generatedAt override", () => {
    const normalized = createNormalizedFixture();
    expect(() =>
      buildPackFromNormalized(normalized, {
        inputPath: "normalized.json",
        timezone: "Europe/Rome",
        pmtilesPath: "packs/demo/base.pmtiles",
        stylePath: "packs/demo/style.json",
        generatedAt: "not-a-date"
      })
    ).toThrow(/Invalid generatedAt timestamp/);
  });
});
