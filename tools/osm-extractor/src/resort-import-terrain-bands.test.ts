import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importResortTerrainBands } from "./resort-import-terrain-bands.js";
import { readResortWorkspace } from "./resort-workspace.js";

async function writeWorkspace(root: string): Promise<string> {
  const workspacePath = join(root, "resort.json");
  await writeFile(
    workspacePath,
    JSON.stringify({
      schemaVersion: "2.1.0",
      resort: { query: { name: "Kicking Horse", country: "CA" } },
      layers: { boundary: { status: "pending" }, lifts: { status: "pending" }, runs: { status: "pending" } }
    }),
    "utf8"
  );
  return workspacePath;
}

describe("importResortTerrainBands", () => {
  it("normalizes terrain band polygons and updates workspace layer state", async () => {
    const root = await mkdtemp(join(tmpdir(), "import-terrain-bands-"));
    try {
      const workspacePath = await writeWorkspace(root);
      const inputPath = join(root, "input-terrain-bands.geojson");
      await writeFile(
        inputPath,
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { id: "tb-2200", eleMin: 2200, eleMax: 2240 },
              geometry: {
                type: "Polygon",
                coordinates: [[[-117.1, 51.2], [-117.09, 51.2], [-117.09, 51.21], [-117.1, 51.2]]]
              }
            },
            {
              type: "Feature",
              properties: { amin: "2240", amax: "2280" },
              geometry: {
                type: "MultiPolygon",
                coordinates: [[[[ -117.08, 51.22], [-117.07, 51.22], [-117.07, 51.23], [-117.08, 51.22]]]]
              }
            }
          ]
        }),
        "utf8"
      );

      const result = await importResortTerrainBands({ workspacePath, inputPath, updatedAt: "2026-03-01T00:00:00.000Z" });
      expect(result.importedFeatureCount).toBe(2);
      const saved = JSON.parse(await readFile(result.outputPath, "utf8")) as {
        features: Array<{ properties: { eleMin: number | null; eleMax: number | null; id: string } }>;
      };
      expect(saved.features).toHaveLength(2);
      expect(saved.features[0]?.properties.id).toBe("tb-2200");
      expect(saved.features[1]?.properties.eleMin).toBe(2240);
      expect(saved.features[1]?.properties.eleMax).toBe(2280);
      const workspace = await readResortWorkspace(workspacePath);
      expect(workspace.layers.terrainBands?.status).toBe("complete");
      expect(workspace.layers.terrainBands?.featureCount).toBe(2);
      expect(workspace.layers.terrainBands?.artifactPath).toBe(result.outputPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

