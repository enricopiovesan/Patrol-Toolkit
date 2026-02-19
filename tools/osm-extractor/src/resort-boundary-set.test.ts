import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setResortBoundary } from "./resort-boundary-set.js";

describe("resort boundary set", () => {
  it("writes boundary artifact and updates workspace state", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-set-"));
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

      const result = await setResortBoundary(
        {
          workspacePath,
          index: 1,
          selectedAt: "2026-02-18T11:00:00.000Z"
        },
        {
          detectFn: async () => ({
            workspacePath,
            candidates: [
              {
                osmType: "relation",
                osmId: 100,
                displayName: "Kicking Horse Resort Boundary",
                center: [-116.95, 51.3],
                source: "selection",
                geometryType: "Polygon",
                ring: [
                  [-117.0, 51.2],
                  [-116.8, 51.2],
                  [-116.8, 51.4],
                  [-117.0, 51.4],
                  [-117.0, 51.2]
                ],
                validation: {
                  containsSelectionCenter: true,
                  ringClosed: true,
                  areaKm2: 250,
                  distanceToSelectionCenterKm: 0.2,
                  score: 100,
                  signals: ["has-polygon", "contains-selection-center"],
                  issues: []
                }
              }
            ]
          })
        }
      );

      expect(result.selectedOsm.osmId).toBe(100);
      const boundaryRaw = await readFile(result.boundaryPath, "utf8");
      const boundary = JSON.parse(boundaryRaw) as { geometry: { type: string }; properties: { osmId: number } };
      expect(boundary.geometry.type).toBe("Polygon");
      expect(boundary.properties.osmId).toBe(100);

      const workspaceRaw = await readFile(workspacePath, "utf8");
      const parsedWorkspace = JSON.parse(workspaceRaw) as {
        layers: { boundary: { status: string; artifactPath: string } };
      };
      expect(parsedWorkspace.layers.boundary.status).toBe("complete");
      expect(parsedWorkspace.layers.boundary.artifactPath).toBe(result.boundaryPath);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects out-of-range index", async () => {
    await expect(
      setResortBoundary(
        {
          workspacePath: "/tmp/resort.json",
          index: 2
        },
        {
          detectFn: async () => ({
            workspacePath: "/tmp/resort.json",
            candidates: []
          })
        }
      )
    ).rejects.toThrow(/out of range/i);
  });
});
