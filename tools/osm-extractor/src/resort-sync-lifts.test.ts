import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLiftsOverpassQuery, syncResortLifts } from "./resort-sync-lifts.js";

describe("resort sync lifts", () => {
  it("builds a bbox query with aerialway filters", () => {
    const query = buildLiftsOverpassQuery({
      minLon: -117,
      minLat: 51.2,
      maxLon: -116.8,
      maxLat: 51.4,
      timeoutSeconds: 30
    });
    expect(query).toMatch(/way\["aerialway"\]/);
    expect(query).toMatch(/relation\["aerialway"\]/);
    expect(query).toMatch(/\[timeout:30\]/);
  });

  it("syncs lifts artifact and updates workspace layer state", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-lifts-"));
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

      const result = await syncResortLifts(
        {
          workspacePath,
          outputPath: join(workspace, "lifts.geojson"),
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
                    id: 42,
                    tags: { aerialway: "chair_lift", name: "Golden Eagle" },
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

      expect(result.liftCount).toBe(1);
      const liftsRaw = await readFile(result.outputPath, "utf8");
      const lifts = JSON.parse(liftsRaw) as { features: Array<{ properties: { aerialway: string } }> };
      expect(lifts.features[0]?.properties.aerialway).toBe("chair_lift");

      const workspaceRaw = await readFile(workspacePath, "utf8");
      const updated = JSON.parse(workspaceRaw) as { layers: { lifts: { status: string; featureCount: number } } };
      expect(updated.layers.lifts.status).toBe("complete");
      expect(updated.layers.lifts.featureCount).toBe(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("fails when boundary layer is not complete", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-lifts-no-boundary-"));
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
      await expect(syncResortLifts({ workspacePath })).rejects.toThrow(/boundary layer is not complete/i);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
