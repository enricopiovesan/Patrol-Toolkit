import { describe, expect, it } from "vitest";
import { toBuildPackJson, toExtractFleetJson, toExtractResortJson, toIngestOsmJson } from "./extraction-result.js";

describe("extraction result JSON formatters", () => {
  it("formats ingest result for machine-readable output", () => {
    const result = toIngestOsmJson({
      schemaVersion: "0.2.0",
      resort: { id: "demo", name: "Demo Resort" },
      source: {
        format: "osm-overpass-json",
        sha256: "abc",
        inputPath: "demo.osm.json",
        osmBaseTimestamp: null
      },
      boundary: {
        source: "relation",
        sourceId: 900,
        polygon: {
          type: "Polygon",
          coordinates: [[[7, 45], [7.01, 45], [7.01, 45.01], [7, 45.01], [7, 45]]]
        }
      },
      lifts: [],
      runs: [],
      warnings: ["x"]
    });

    expect(result).toEqual({
      ok: true,
      ingestion: {
        resortId: "demo",
        resortName: "Demo Resort",
        counts: {
          runs: 0,
          lifts: 0,
          warnings: 1
        },
        boundary: {
          present: true,
          source: "relation",
          sourceId: 900
        }
      }
    });
  });

  it("formats ingest result with missing boundary metadata", () => {
    const result = toIngestOsmJson({
      schemaVersion: "0.2.0",
      resort: { id: "demo", name: "Demo Resort" },
      source: {
        format: "osm-overpass-json",
        sha256: "abc",
        inputPath: "demo.osm.json",
        osmBaseTimestamp: null
      },
      boundary: null,
      lifts: [],
      runs: [],
      warnings: []
    });

    expect(result.ingestion.boundary).toEqual({
      present: false,
      source: null,
      sourceId: null
    });
  });

  it("formats build-pack result for machine-readable output", () => {
    const result = toBuildPackJson({
      packPath: "/tmp/pack.json",
      reportPath: "/tmp/report.json",
      pack: {
        schemaVersion: "1.0.0",
        resort: { id: "demo", name: "Demo Resort", timezone: "Europe/Rome" },
        basemap: { pmtilesPath: "a", stylePath: "b" },
        thresholds: { liftProximityMeters: 90 },
        lifts: [{ id: "lift-a", name: "Lift A", towers: [{ number: 1, coordinates: [7, 45] }] }],
        runs: [
          {
            id: "run-a",
            name: "Run A",
            difficulty: "blue",
            polygon: { type: "Polygon", coordinates: [[[7, 45], [7.01, 45], [7, 45]]] },
            centerline: { type: "LineString", coordinates: [[7, 45], [7.01, 45]] }
          }
        ]
      },
      report: {
        schemaVersion: "0.3.0",
        generatedAt: "2026-02-18T10:00:00.000Z",
        sourceInput: "normalized.json",
        resortId: "demo",
        counts: { runs: 1, lifts: 1, towers: 1 },
        boundaryGate: { status: "passed", issues: [] },
        warnings: []
      }
    });

    expect(result).toEqual({
      ok: true,
      build: {
        resortId: "demo",
        schemaVersion: "1.0.0",
        counts: {
          runs: 1,
          lifts: 1,
          towers: 1
        },
        boundaryGate: "passed",
        artifacts: {
          packPath: "/tmp/pack.json",
          reportPath: "/tmp/report.json"
        }
      }
    });
  });

  it("formats build-pack result with boundary gate failure", () => {
    const result = toBuildPackJson({
      packPath: "/tmp/pack.json",
      reportPath: "/tmp/report.json",
      pack: {
        schemaVersion: "1.0.0",
        resort: { id: "demo", name: "Demo Resort", timezone: "Europe/Rome" },
        basemap: { pmtilesPath: "a", stylePath: "b" },
        thresholds: { liftProximityMeters: 90 },
        lifts: [],
        runs: []
      },
      report: {
        schemaVersion: "0.3.0",
        generatedAt: "2026-02-18T10:00:00.000Z",
        sourceInput: "normalized.json",
        resortId: "demo",
        counts: { runs: 0, lifts: 0, towers: 0 },
        boundaryGate: {
          status: "failed",
          issues: [
            {
              entityType: "run",
              entityId: "run-a",
              message: "run-a is outside boundary"
            }
          ]
        },
        warnings: []
      }
    });

    expect(result.build.boundaryGate).toBe("failed");
  });

  it("formats resort extraction result for machine-readable output", () => {
    const result = toExtractResortJson({
      resortId: "demo-resort",
      generatedAt: "2026-02-18T10:00:00.000Z",
      runCount: 7,
      liftCount: 4,
      boundaryGate: "passed",
      normalizedPath: "/tmp/normalized.json",
      packPath: "/tmp/pack.json",
      reportPath: "/tmp/report.json",
      provenancePath: "/tmp/provenance.json",
      checksums: {
        normalizedSha256: "a",
        packSha256: "b",
        reportSha256: "c"
      }
    });

    expect(result).toEqual({
      ok: true,
      extraction: {
        resortId: "demo-resort",
        generatedAt: "2026-02-18T10:00:00.000Z",
        counts: {
          runs: 7,
          lifts: 4
        },
        boundaryGate: "passed",
        artifacts: {
          packPath: "/tmp/pack.json",
          reportPath: "/tmp/report.json",
          normalizedPath: "/tmp/normalized.json",
          provenancePath: "/tmp/provenance.json"
        },
        checksums: {
          packSha256: "b",
          reportSha256: "c",
          normalizedSha256: "a"
        }
      }
    });
  });

  it("formats fleet extraction result for machine-readable output", () => {
    const result = toExtractFleetJson({
      manifestPath: "/tmp/fleet-manifest.json",
      provenancePath: "/tmp/fleet-provenance.json",
      manifest: {
        schemaVersion: "1.0.0",
        generatedAt: "2026-02-18T10:00:00.000Z",
        fleetSize: 3,
        successCount: 2,
        failureCount: 1,
        entries: []
      }
    });

    expect(result).toEqual({
      ok: true,
      fleet: {
        generatedAt: "2026-02-18T10:00:00.000Z",
        totals: {
          resorts: 3,
          success: 2,
          failed: 1
        },
        artifacts: {
          manifestPath: "/tmp/fleet-manifest.json",
          provenancePath: "/tmp/fleet-provenance.json"
        }
      }
    });
  });
});
