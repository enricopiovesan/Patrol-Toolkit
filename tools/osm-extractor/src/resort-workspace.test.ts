import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertResortWorkspace, readResortWorkspace } from "./resort-workspace.js";

describe("resort workspace schema", () => {
  it("loads a valid workspace file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-workspace-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: {
              name: "Kicking Horse",
              country: "CA"
            },
            selection: {
              osmType: "relation",
              osmId: 123456,
              displayName: "Kicking Horse Mountain Resort",
              center: [-116.957, 51.298],
              selectedAt: "2026-02-18T10:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "complete", featureCount: 1, updatedAt: "2026-02-18T10:01:00.000Z" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const loaded = await readResortWorkspace(workspacePath);
      expect(loaded.schemaVersion).toBe("2.0.0");
      expect(loaded.resort.query.name).toBe("Kicking Horse");
      expect(loaded.layers.boundary.status).toBe("complete");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects invalid layer status", () => {
    expect(() =>
      assertResortWorkspace({
        schemaVersion: "2.0.0",
        resort: {
          query: { name: "Kicking Horse", country: "CA" }
        },
        layers: {
          boundary: { status: "done" },
          lifts: { status: "pending" },
          runs: { status: "pending" }
        }
      })
    ).toThrow(/Invalid resort workspace/);
  });

  it("rejects invalid resort selection identity", () => {
    expect(() =>
      assertResortWorkspace({
        schemaVersion: "2.0.0",
        resort: {
          query: { name: "Kicking Horse", country: "CA" },
          selection: {
            osmType: "relation",
            osmId: "123456",
            displayName: "Kicking Horse Mountain Resort",
            center: [-116.957, 51.298],
            selectedAt: "2026-02-18T10:00:00.000Z"
          }
        },
        layers: {
          boundary: { status: "pending" },
          lifts: { status: "pending" },
          runs: { status: "pending" }
        }
      })
    ).toThrow(/Invalid resort workspace/);
  });
});
