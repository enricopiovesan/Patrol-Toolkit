import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunsOverpassQuery, syncResortRuns } from "./resort-sync-runs.js";

describe("resort sync runs", () => {
  it("builds a bbox query with downhill filters", () => {
    const query = buildRunsOverpassQuery({
      minLon: -117,
      minLat: 51.2,
      maxLon: -116.8,
      maxLat: 51.4,
      timeoutSeconds: 30
    });
    expect(query).toMatch(/way\["piste:type"="downhill"\]/);
    expect(query).toMatch(/relation\["piste:type"="downhill"\]/);
    expect(query).toMatch(/\[timeout:30\]/);
  });

  it("syncs runs artifact and updates workspace layer state", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-runs-"));
    const workspacePath = join(workspace, "resort.json");
    const boundaryPath = join(workspace, "boundary.geojson");

    try {
      await writeFile(
        boundaryPath,
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-117.0, 51.2],
                [-116.8, 51.2],
                [-116.8, 51.4],
                [-117.0, 51.4],
                [-117.0, 51.2]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" },
            selection: {
              osmType: "relation",
              osmId: 100,
              displayName: "Kicking Horse Resort",
              center: [-116.95, 51.3],
              selectedAt: "2026-02-18T10:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "complete", artifactPath: boundaryPath, featureCount: 1 },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await syncResortRuns(
        {
          workspacePath,
          outputPath: join(workspace, "runs.geojson"),
          updatedAt: "2026-02-18T11:00:00.000Z"
        },
        {
          fetchFn: (async () =>
            ({
              ok: true,
              status: 200,
              json: async () => ({
                elements: [
                  {
                    type: "way",
                    id: 84,
                    tags: { "piste:type": "downhill", name: "Pioneer", "piste:difficulty": "blue" },
                    geometry: [
                      { lon: -116.95, lat: 51.3 },
                      { lon: -116.94, lat: 51.31 }
                    ]
                  }
                ]
              })
            }) as Response) as typeof fetch
        }
      );

      expect(result.runCount).toBe(1);
      const runsRaw = await readFile(result.outputPath, "utf8");
      const runs = JSON.parse(runsRaw) as { features: Array<{ properties: { difficulty: string } }> };
      expect(runs.features[0]?.properties.difficulty).toBe("blue");

      const workspaceRaw = await readFile(workspacePath, "utf8");
      const updated = JSON.parse(workspaceRaw) as { layers: { runs: { status: string; featureCount: number } } };
      expect(updated.layers.runs.status).toBe("complete");
      expect(updated.layers.runs.featureCount).toBe(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("fails when boundary layer is not complete", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-runs-no-boundary-"));
    const workspacePath = join(workspace, "resort.json");
    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" },
            selection: {
              osmType: "relation",
              osmId: 100,
              displayName: "Kicking Horse Resort",
              center: [-116.95, 51.3],
              selectedAt: "2026-02-18T10:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );
      await expect(syncResortRuns({ workspacePath })).rejects.toThrow(/boundary layer is not complete/i);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
