import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditLogger } from "./audit-log.js";
import { runExtractFleetPipeline } from "./fleet-run.js";

function buildDemoOsm(): Record<string, unknown> {
  return {
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
}

describe("runExtractFleetPipeline", () => {
  it("builds manifest for successful multi-resort extraction", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-run-success-"));
    const resortsDir = join(workspace, "resorts");
    const osmPathA = join(workspace, "a.osm.json");
    const osmPathB = join(workspace, "b.osm.json");
    const resortConfigA = join(resortsDir, "a.json");
    const resortConfigB = join(resortsDir, "b.json");
    const fleetConfigPath = join(workspace, "fleet-config.json");

    try {
      await mkdir(resortsDir, { recursive: true });
      await writeFile(osmPathA, JSON.stringify(buildDemoOsm()), "utf8");
      await writeFile(osmPathB, JSON.stringify(buildDemoOsm()), "utf8");

      await writeFile(
        resortConfigA,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "resort-a", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "../a.osm.json" },
          output: { directory: "../out/a" },
          basemap: { pmtilesPath: "packs/a/base.pmtiles", stylePath: "packs/a/style.json" }
        }),
        "utf8"
      );
      await writeFile(
        resortConfigB,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "resort-b", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "../b.osm.json" },
          output: { directory: "../out/b" },
          basemap: { pmtilesPath: "packs/b/base.pmtiles", stylePath: "packs/b/style.json" }
        }),
        "utf8"
      );

      await writeFile(
        fleetConfigPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: { manifestPath: "./out/fleet-manifest.json" },
          resorts: [
            { id: "resort-a", configPath: "./resorts/a.json" },
            { id: "resort-b", configPath: "./resorts/b.json" }
          ]
        }),
        "utf8"
      );

      const result = await runExtractFleetPipeline(fleetConfigPath);
      expect(result.manifest.fleetSize).toBe(2);
      expect(result.manifest.successCount).toBe(2);
      expect(result.manifest.failureCount).toBe(0);

      const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as Record<string, unknown>;
      expect(manifest.schemaVersion).toBe("1.0.0");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("writes manifest and fails fast when continueOnError is false", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-run-fail-"));
    const resortsDir = join(workspace, "resorts");
    const osmPath = join(workspace, "ok.osm.json");
    const okConfig = join(resortsDir, "ok.json");
    const badConfig = join(resortsDir, "bad.json");
    const fleetConfigPath = join(workspace, "fleet-config.json");

    try {
      await mkdir(resortsDir, { recursive: true });
      await writeFile(osmPath, JSON.stringify(buildDemoOsm()), "utf8");
      await writeFile(
        okConfig,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "ok-resort", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "../ok.osm.json" },
          output: { directory: "../out/ok" },
          basemap: { pmtilesPath: "packs/ok/base.pmtiles", stylePath: "packs/ok/style.json" }
        }),
        "utf8"
      );
      await writeFile(
        badConfig,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "bad-resort", timezone: "" },
          source: { osmInputPath: "../missing.osm.json" },
          output: { directory: "../out/bad" },
          basemap: { pmtilesPath: "packs/bad/base.pmtiles", stylePath: "packs/bad/style.json" }
        }),
        "utf8"
      );
      await writeFile(
        fleetConfigPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: { manifestPath: "./out/fleet-manifest.json" },
          resorts: [
            { id: "ok-resort", configPath: "./resorts/ok.json" },
            { id: "bad-resort", configPath: "./resorts/bad.json" }
          ]
        }),
        "utf8"
      );

      await expect(runExtractFleetPipeline(fleetConfigPath)).rejects.toThrow(/Fleet extraction failed/);
      const manifest = JSON.parse(await readFile(join(workspace, "out/fleet-manifest.json"), "utf8")) as {
        failureCount: number;
      };
      expect(manifest.failureCount).toBe(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("writes fleet-level audit events when logger is provided", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-run-logs-"));
    const resortsDir = join(workspace, "resorts");
    const osmPath = join(workspace, "ok.osm.json");
    const resortConfig = join(resortsDir, "ok.json");
    const fleetConfigPath = join(workspace, "fleet-config.json");
    const logPath = join(workspace, "logs", "fleet-audit.jsonl");

    try {
      await mkdir(resortsDir, { recursive: true });
      await writeFile(osmPath, JSON.stringify(buildDemoOsm()), "utf8");
      await writeFile(
        resortConfig,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { id: "ok-resort", timezone: "Europe/Rome", boundaryRelationId: 900 },
          source: { osmInputPath: "../ok.osm.json" },
          output: { directory: "../out/ok" },
          basemap: { pmtilesPath: "packs/ok/base.pmtiles", stylePath: "packs/ok/style.json" }
        }),
        "utf8"
      );
      await writeFile(
        fleetConfigPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: { manifestPath: "./out/fleet-manifest.json" },
          resorts: [{ id: "ok-resort", configPath: "./resorts/ok.json" }]
        }),
        "utf8"
      );

      const logger = await createAuditLogger(logPath);
      await runExtractFleetPipeline(fleetConfigPath, { logger });

      const lines = (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { event: string });
      expect(lines.some((entry) => entry.event === "fleet_pipeline_started")).toBe(true);
      expect(lines.some((entry) => entry.event === "fleet_manifest_written")).toBe(true);
      expect(lines.some((entry) => entry.event === "fleet_pipeline_completed")).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
