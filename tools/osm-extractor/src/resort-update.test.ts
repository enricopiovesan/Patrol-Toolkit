import { describe, expect, it, vi } from "vitest";
import { updateResortLayer } from "./resort-update.js";
import type { ResortWorkspace } from "./resort-workspace.js";

function createWorkspace(layer: "boundary" | "lifts" | "runs", state: Partial<ResortWorkspace["layers"]["boundary"]>): ResortWorkspace {
  return {
    schemaVersion: "2.0.0",
    resort: {
      query: {
        name: "Kicking Horse",
        country: "CA"
      }
    },
    layers: {
      boundary: {
        status: "pending"
      },
      lifts: {
        status: "pending"
      },
      runs: {
        status: "pending"
      },
      [layer]: {
        status: "pending",
        ...state
      }
    }
  };
}

describe("resort update", () => {
  it("requires index for boundary updates", async () => {
    const readWorkspaceFn = vi
      .fn<(...args: [string]) => Promise<ResortWorkspace>>()
      .mockResolvedValue(createWorkspace("boundary", { status: "pending" }));

    await expect(
      updateResortLayer(
        {
          workspacePath: "/tmp/resort.json",
          layer: "boundary"
        },
        { readWorkspaceFn }
      )
    ).rejects.toThrow(/requires --index/i);
  });

  it("dispatches to runs sync and reports changed fields", async () => {
    const readWorkspaceFn = vi
      .fn<(...args: [string]) => Promise<ResortWorkspace>>()
      .mockResolvedValueOnce(createWorkspace("runs", { status: "pending" }))
      .mockResolvedValueOnce(
        createWorkspace("runs", {
          status: "complete",
          artifactPath: "/tmp/runs.geojson",
          featureCount: 3,
          checksumSha256: "abc",
          updatedAt: "2026-02-19T10:00:00.000Z"
        })
      );

    const syncRunsFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      outputPath: "/tmp/runs.geojson",
      queryHash: "q1",
      runCount: 3,
      checksumSha256: "abc"
    });

    const result = await updateResortLayer(
      {
        workspacePath: "/tmp/resort.json",
        layer: "runs",
        outputPath: "/tmp/runs.geojson",
        bufferMeters: 50,
        timeoutSeconds: 25,
        updatedAt: "2026-02-19T10:00:00.000Z"
      },
      {
        readWorkspaceFn,
        syncRunsFn
      }
    );

    expect(syncRunsFn).toHaveBeenCalledWith({
      workspacePath: "/tmp/resort.json",
      outputPath: "/tmp/runs.geojson",
      bufferMeters: 50,
      timeoutSeconds: 25,
      updatedAt: "2026-02-19T10:00:00.000Z"
    });
    expect(result.operation.kind).toBe("runs");
    expect(result.dryRun).toBe(false);
    expect(result.changed).toBe(true);
    expect(result.changedFields).toEqual(["status", "artifactPath", "featureCount", "checksumSha256", "updatedAt"]);
  });

  it("reports no diff when layer snapshot does not change", async () => {
    const workspace = createWorkspace("lifts", {
      status: "complete",
      artifactPath: "/tmp/lifts.geojson",
      featureCount: 2,
      checksumSha256: "same",
      updatedAt: "2026-02-19T09:00:00.000Z"
    });

    const readWorkspaceFn = vi.fn<(...args: [string]) => Promise<ResortWorkspace>>().mockResolvedValue(workspace);
    const syncLiftsFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      outputPath: "/tmp/lifts.geojson",
      queryHash: "q1",
      liftCount: 2,
      checksumSha256: "same"
    });

    const result = await updateResortLayer(
      {
        workspacePath: "/tmp/resort.json",
        layer: "lifts"
      },
      {
        readWorkspaceFn,
        syncLiftsFn
      }
    );

    expect(result.changed).toBe(false);
    expect(result.changedFields).toEqual([]);
    expect(result.readiness.ready).toBe(true);
    expect(result.readiness.issues).toEqual([]);
  });

  it("does not execute layer sync when dry-run is enabled", async () => {
    const workspace = createWorkspace("lifts", {
      status: "pending"
    });
    const readWorkspaceFn = vi.fn<(...args: [string]) => Promise<ResortWorkspace>>().mockResolvedValue(workspace);
    const syncLiftsFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      outputPath: "/tmp/lifts.geojson",
      queryHash: "q1",
      liftCount: 2,
      checksumSha256: "same"
    });

    const result = await updateResortLayer(
      {
        workspacePath: "/tmp/resort.json",
        layer: "lifts",
        dryRun: true
      },
      {
        readWorkspaceFn,
        syncLiftsFn
      }
    );

    expect(syncLiftsFn).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.operation.kind).toBe("dry-run");
    expect(result.changed).toBe(false);
    expect(result.changedFields).toEqual([]);
  });

  it("reports layer as not ready when expected fields are missing", async () => {
    const readWorkspaceFn = vi
      .fn<(...args: [string]) => Promise<ResortWorkspace>>()
      .mockResolvedValue(createWorkspace("runs", { status: "pending" }))
      .mockResolvedValueOnce(createWorkspace("runs", { status: "pending" }));
    const syncRunsFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      outputPath: "/tmp/runs.geojson",
      queryHash: "q1",
      runCount: 0,
      checksumSha256: "same"
    });

    const result = await updateResortLayer(
      {
        workspacePath: "/tmp/resort.json",
        layer: "runs",
        dryRun: true
      },
      {
        readWorkspaceFn,
        syncRunsFn
      }
    );

    expect(result.readiness.ready).toBe(false);
    expect(result.readiness.issues.join(" | ")).toMatch(/status is 'pending'/);
    expect(result.readiness.issues.join(" | ")).toMatch(/featureCount is missing/);
  });
});
