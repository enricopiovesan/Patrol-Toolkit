import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestOsmToFile, normalizeOsmDocument } from "./osm-ingest.js";
import type { OSMDocument } from "./osm-types.js";

const demoDocument: OSMDocument = {
  version: 0.6,
  generator: "test",
  osm3s: {
    timestamp_osm_base: "2026-02-18T10:00:00Z"
  },
  elements: [
    { type: "node", id: 20, lat: 45.001, lon: 7.001 },
    { type: "node", id: 21, lat: 45.002, lon: 7.002 },
    { type: "node", id: 22, lat: 45.003, lon: 7.003 },
    { type: "way", id: 300, nodes: [1, 2, 3, 4, 1], tags: { leisure: "winter_sports", name: "Demo Resort" } },
    { type: "node", id: 1, lat: 45, lon: 7 },
    { type: "node", id: 2, lat: 45, lon: 7.01 },
    { type: "node", id: 3, lat: 45.01, lon: 7.01 },
    { type: "node", id: 4, lat: 45.01, lon: 7 },
    {
      type: "relation",
      id: 900,
      members: [{ type: "way", ref: 300, role: "outer" }],
      tags: { type: "multipolygon", leisure: "winter_sports", name: "Demo Resort" }
    },
    { type: "node", id: 12, lat: 45.05, lon: 7.05 },
    { type: "node", id: 10, lat: 45.03, lon: 7.03 },
    { type: "node", id: 11, lat: 45.04, lon: 7.04 },
    {
      type: "way",
      id: 200,
      nodes: [10, 11, 12],
      tags: { aerialway: "chair_lift", name: "Eagle Chair" }
    },
    {
      type: "way",
      id: 100,
      nodes: [20, 21, 22],
      tags: { "piste:type": "downhill", "piste:difficulty": "intermediate", name: "Bluebird" }
    }
  ]
};

describe("normalizeOsmDocument", () => {
  it("extracts boundary, runs, and lifts from local OSM data", () => {
    const result = normalizeOsmDocument(demoDocument, {
      sourceHash: "abc123",
      inputPath: "demo.osm.json",
      boundaryRelationId: 900
    });

    expect(result.schemaVersion).toBe("0.2.0");
    expect(result.resort).toEqual({
      id: "demo-resort",
      name: "Demo Resort"
    });
    expect(result.source.sha256).toBe("abc123");
    expect(result.source.inputPath).toBe("demo.osm.json");
    expect(result.source.osmBaseTimestamp).toBe("2026-02-18T10:00:00Z");

    expect(result.boundary).toEqual({
      source: "relation",
      sourceId: 900,
      polygon: {
        type: "Polygon",
        coordinates: [[[7, 45], [7.01, 45], [7.01, 45.01], [7, 45.01], [7, 45]]]
      }
    });

    expect(result.lifts).toHaveLength(1);
    expect(result.lifts[0]).toEqual({
      id: "lift-way-200",
      name: "Eagle Chair",
      kind: "chair_lift",
      sourceWayId: 200,
      line: {
        type: "LineString",
        coordinates: [[7.03, 45.03], [7.04, 45.04], [7.05, 45.05]]
      },
      towers: [
        { number: 1, coordinates: [7.03, 45.03] },
        { number: 2, coordinates: [7.04, 45.04] },
        { number: 3, coordinates: [7.05, 45.05] }
      ]
    });

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toEqual({
      id: "run-way-100",
      name: "Bluebird",
      difficulty: "intermediate",
      sourceWayId: 100,
      centerline: {
        type: "LineString",
        coordinates: [[7.001, 45.001], [7.002, 45.002], [7.003, 45.003]]
      }
    });

    expect(result.warnings).toEqual([]);
  });

  it("is deterministic for the same OSM input and options", () => {
    const left = normalizeOsmDocument(demoDocument, {
      sourceHash: "same-hash",
      inputPath: "stable.osm.json",
      boundaryRelationId: 900
    });
    const right = normalizeOsmDocument(demoDocument, {
      sourceHash: "same-hash",
      inputPath: "stable.osm.json",
      boundaryRelationId: 900
    });

    expect(right).toEqual(left);
  });

  it("writes normalized data to output file through ingestOsmToFile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "osm-ingest-"));
    const inputPath = join(workspace, "input.osm.json");
    const outputPath = join(workspace, "output.normalized.json");

    try {
      await writeFile(inputPath, JSON.stringify(demoDocument), "utf8");

      const result = await ingestOsmToFile({
        inputPath,
        outputPath,
        boundaryRelationId: 900
      });

      const written = JSON.parse(await readFile(outputPath, "utf8")) as Record<string, unknown>;
      expect(written.schemaVersion).toBe("0.2.0");
      expect(written.resort).toEqual(result.resort);
      expect(written.source).toEqual(result.source);
      expect(written.boundary).toEqual(result.boundary);
      expect(written.lifts).toEqual(result.lifts);
      expect(written.runs).toEqual(result.runs);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
