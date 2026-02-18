import { readFile } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditLogger } from "./audit-log.js";
import { runExtractResortPipeline } from "./pipeline-run.js";

describe("runExtractResortPipeline", () => {
  it("runs ingest + pack build end-to-end from config", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "extract-pipeline-"));
    const osmPath = join(workspace, "demo.osm.json");
    const configPath = join(workspace, "extract-config.json");

    const osmDocument = {
      version: 0.6,
      generator: "test",
      elements: [
        { type: "node", id: 1, lat: 45, lon: 7 },
        { type: "node", id: 2, lat: 45, lon: 7.01 },
        { type: "node", id: 3, lat: 45.01, lon: 7.01 },
        { type: "node", id: 4, lat: 45.01, lon: 7 },
        {
          type: "way",
          id: 300,
          nodes: [1, 2, 3, 4, 1],
          tags: { leisure: "winter_sports", name: "Demo Resort" }
        },
        {
          type: "relation",
          id: 900,
          members: [{ type: "way", ref: 300, role: "outer" }],
          tags: { type: "multipolygon", leisure: "winter_sports", name: "Demo Resort" }
        },
        { type: "node", id: 10, lat: 45.001, lon: 7.001 },
        { type: "node", id: 11, lat: 45.002, lon: 7.002 },
        { type: "way", id: 100, nodes: [10, 11], tags: { "piste:type": "downhill", "piste:difficulty": "blue" } },
        { type: "node", id: 20, lat: 45.003, lon: 7.003 },
        { type: "node", id: 21, lat: 45.004, lon: 7.004 },
        { type: "way", id: 200, nodes: [20, 21], tags: { aerialway: "chair_lift", name: "Lift A" } }
      ]
    };

    try {
      await writeFile(osmPath, JSON.stringify(osmDocument), "utf8");
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: {
            id: "demo-resort",
            timezone: "Europe/Rome",
            boundaryRelationId: 900
          },
          source: {
            osmInputPath: "./demo.osm.json"
          },
          output: {
            directory: "./out"
          },
          basemap: {
            pmtilesPath: "packs/demo/base.pmtiles",
            stylePath: "packs/demo/style.json"
          },
          determinism: {
            generatedAt: "2026-02-18T10:00:00.000Z"
          }
        }),
        "utf8"
      );

      const result = await runExtractResortPipeline(configPath);
      expect(result.resortId).toBe("demo-resort");
      expect(result.runCount).toBe(1);
      expect(result.liftCount).toBe(1);
      expect(result.boundaryGate).toBe("passed");
      expect(result.checksums.packSha256.length).toBe(64);
      expect(result.provenancePath.endsWith("provenance.json")).toBe(true);

      const pack = JSON.parse(await readFile(result.packPath, "utf8")) as Record<string, unknown>;
      const report = JSON.parse(await readFile(result.reportPath, "utf8")) as Record<string, unknown>;
      const provenance = JSON.parse(await readFile(result.provenancePath, "utf8")) as Record<string, unknown>;
      expect(result.generatedAt).toBe("2026-02-18T10:00:00.000Z");
      expect(pack.schemaVersion).toBe("1.0.0");
      expect(report.schemaVersion).toBe("0.3.0");
      expect(provenance.schemaVersion).toBe("1.2.0");
      expect(report.generatedAt).toBe("2026-02-18T10:00:00.000Z");
      expect(provenance.generatedAt).toBe("2026-02-18T10:00:00.000Z");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("writes structured audit events when logger is provided", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "extract-pipeline-log-"));
    const osmPath = join(workspace, "demo.osm.json");
    const configPath = join(workspace, "extract-config.json");
    const logPath = join(workspace, "logs", "audit.jsonl");

    const osmDocument = {
      version: 0.6,
      generator: "test",
      elements: [
        { type: "node", id: 1, lat: 45, lon: 7 },
        { type: "node", id: 2, lat: 45, lon: 7.01 },
        { type: "node", id: 3, lat: 45.01, lon: 7.01 },
        { type: "node", id: 4, lat: 45.01, lon: 7 },
        { type: "way", id: 300, nodes: [1, 2, 3, 4, 1], tags: { leisure: "winter_sports", name: "Demo Resort" } },
        {
          type: "relation",
          id: 900,
          members: [{ type: "way", ref: 300, role: "outer" }],
          tags: { type: "multipolygon", leisure: "winter_sports", name: "Demo Resort" }
        },
        { type: "node", id: 10, lat: 45.001, lon: 7.001 },
        { type: "node", id: 11, lat: 45.002, lon: 7.002 },
        { type: "way", id: 100, nodes: [10, 11], tags: { "piste:type": "downhill", "piste:difficulty": "blue" } },
        { type: "node", id: 20, lat: 45.003, lon: 7.003 },
        { type: "node", id: 21, lat: 45.004, lon: 7.004 },
        { type: "way", id: 200, nodes: [20, 21], tags: { aerialway: "chair_lift", name: "Lift A" } }
      ]
    };

    try {
      await writeFile(osmPath, JSON.stringify(osmDocument), "utf8");
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "demo-resort", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "./demo.osm.json" },
          output: { directory: "./out" },
          basemap: { pmtilesPath: "packs/demo/base.pmtiles", stylePath: "packs/demo/style.json" }
        }),
        "utf8"
      );

      const logger = await createAuditLogger(logPath);
      await runExtractResortPipeline(configPath, { logger });

      const lines = (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { event: string });
      expect(lines.some((entry) => entry.event === "resort_pipeline_started")).toBe(true);
      expect(lines.some((entry) => entry.event === "resort_provenance_written")).toBe(true);
      expect(lines.some((entry) => entry.event === "resort_pipeline_completed")).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("fails fast when area bbox filters out required entities", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "extract-pipeline-bbox-"));
    const osmPath = join(workspace, "demo.osm.json");
    const configPath = join(workspace, "extract-config.json");

    const osmDocument = {
      version: 0.6,
      generator: "test",
      elements: [
        { type: "node", id: 1, lat: 45, lon: 7 },
        { type: "node", id: 2, lat: 45, lon: 7.01 },
        { type: "node", id: 3, lat: 45.01, lon: 7.01 },
        { type: "node", id: 4, lat: 45.01, lon: 7 },
        { type: "way", id: 300, nodes: [1, 2, 3, 4, 1], tags: { leisure: "winter_sports", name: "Demo Resort" } },
        {
          type: "relation",
          id: 900,
          members: [{ type: "way", ref: 300, role: "outer" }],
          tags: { type: "multipolygon", leisure: "winter_sports", name: "Demo Resort" }
        },
        { type: "node", id: 10, lat: 45.001, lon: 7.001 },
        { type: "node", id: 11, lat: 45.002, lon: 7.002 },
        { type: "way", id: 100, nodes: [10, 11], tags: { "piste:type": "downhill", "piste:difficulty": "blue" } },
        { type: "node", id: 20, lat: 45.03, lon: 7.03 },
        { type: "node", id: 21, lat: 45.04, lon: 7.04 },
        { type: "way", id: 200, nodes: [20, 21], tags: { aerialway: "chair_lift", name: "Lift A" } }
      ]
    };

    try {
      await writeFile(osmPath, JSON.stringify(osmDocument), "utf8");
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "demo-resort", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "./demo.osm.json", area: { bbox: [6.99, 44.99, 7.01, 45.01] } },
          output: { directory: "./out" },
          basemap: { pmtilesPath: "packs/demo/base.pmtiles", stylePath: "packs/demo/style.json" }
        }),
        "utf8"
      );

      await expect(runExtractResortPipeline(configPath)).rejects.toThrow(/Generated pack failed schema validation/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
