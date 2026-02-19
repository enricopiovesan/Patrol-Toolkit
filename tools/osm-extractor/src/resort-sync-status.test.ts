import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readResortSyncStatus } from "./resort-sync-status.js";

describe("resort sync status", () => {
  it("returns ready when all layers are complete and valid", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-status-ready-"));
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
            boundary: {
              status: "complete",
              artifactPath: "/tmp/boundary.geojson",
              featureCount: 1,
              checksumSha256: "abc",
              updatedAt: "2026-02-18T11:00:00.000Z"
            },
            lifts: {
              status: "complete",
              artifactPath: "/tmp/lifts.geojson",
              featureCount: 10,
              checksumSha256: "def",
              updatedAt: "2026-02-18T11:00:00.000Z"
            },
            runs: {
              status: "complete",
              artifactPath: "/tmp/runs.geojson",
              featureCount: 20,
              checksumSha256: "ghi",
              updatedAt: "2026-02-18T11:00:00.000Z"
            }
          }
        }),
        "utf8"
      );

      const status = await readResortSyncStatus(workspacePath);
      expect(status.overall).toBe("ready");
      expect(status.issues).toEqual([]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("returns incomplete with clear issues when layers are not ready", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-sync-status-incomplete-"));
    const workspacePath = join(workspace, "resort.json");
    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" }
          },
          layers: {
            boundary: {
              status: "complete",
              artifactPath: "/tmp/boundary.geojson",
              featureCount: 2,
              checksumSha256: "abc",
              updatedAt: "2026-02-18T11:00:00.000Z"
            },
            lifts: {
              status: "failed",
              error: "HTTP 429"
            },
            runs: {
              status: "pending"
            }
          }
        }),
        "utf8"
      );

      const status = await readResortSyncStatus(workspacePath);
      expect(status.overall).toBe("incomplete");
      expect(status.issues.join(" | ")).toMatch(/boundary featureCount must be exactly 1/);
      expect(status.issues.join(" | ")).toMatch(/lifts: status is 'failed'/);
      expect(status.issues.join(" | ")).toMatch(/runs: status is 'pending'/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
