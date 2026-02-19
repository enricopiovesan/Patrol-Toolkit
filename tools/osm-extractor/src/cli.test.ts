import { describe, expect, it, vi } from "vitest";
import { CliCommandError, formatCliError, isCliEntryPointUrl, parseResortUpdateOptions, runResortUpdateCommand } from "./cli.js";

describe("CLI error JSON format", () => {
  it("formats explicit command errors with code and details", () => {
    const result = formatCliError(
      new CliCommandError("INVALID_FLAG_VALUE", "Flag --bbox expects min values <= max values.", {
        flag: "--bbox",
        expected: "min<=max",
        value: "8,45,7,44"
      }),
      "ingest-osm"
    );

    expect(result).toEqual({
      ok: false,
      error: {
        command: "ingest-osm",
        code: "INVALID_FLAG_VALUE",
        message: "Flag --bbox expects min values <= max values.",
        details: {
          flag: "--bbox",
          expected: "min<=max",
          value: "8,45,7,44"
        }
      }
    });
  });

  it("formats unexpected failures with generic command failure code", () => {
    const result = formatCliError(new Error("unexpected failure"), "build-pack");
    expect(result).toEqual({
      ok: false,
      error: {
        command: "build-pack",
        code: "COMMAND_FAILED",
        message: "unexpected failure"
      }
    });
  });
});

describe("CLI entrypoint detection", () => {
  it("matches import URL when entry path is relative", () => {
    const importMetaUrl = "file:///repo/tools/osm-extractor/dist/src/cli.js";
    const result = isCliEntryPointUrl({
      importMetaUrl,
      entryPath: "/repo/tools/osm-extractor/dist/src/../src/cli.js"
    });
    expect(result).toBe(true);
  });
});

describe("resort-update option parsing", () => {
  it("parses valid lifts layer options", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "lifts",
      "--buffer-meters",
      "40",
      "--timeout-seconds",
      "25"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "lifts",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: 40,
      timeoutSeconds: 25,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: false
    });
  });

  it("parses dry-run flag", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "runs",
      "--dry-run"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "runs",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: undefined,
      timeoutSeconds: undefined,
      updatedAt: undefined,
      dryRun: true,
      requireComplete: false
    });
  });

  it("parses require-complete flag", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "runs",
      "--require-complete"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "runs",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: undefined,
      timeoutSeconds: undefined,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: true
    });
  });

  it("parses layer all with required boundary index", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "all",
      "--index",
      "2",
      "--search-limit",
      "6",
      "--buffer-meters",
      "100",
      "--timeout-seconds",
      "40"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "all",
      outputPath: undefined,
      index: 2,
      searchLimit: 6,
      bufferMeters: 100,
      timeoutSeconds: 40,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: false
    });
  });

  it("allows layer all dry-run without boundary index", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "all",
      "--dry-run"
    ]);

    expect(result.layer).toBe("all");
    expect(result.index).toBeUndefined();
    expect(result.dryRun).toBe(true);
  });

  it("rejects boundary layer when index is missing", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "boundary"
      ])
    ).toThrow(/requires --index/i);
  });

  it("rejects lifts/runs layer with boundary-only flags", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "runs",
        "--index",
        "1"
      ])
    ).toThrow(/does not accept --index or --search-limit/i);
  });

  it("rejects boundary layer with run/lift-only flags", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "boundary",
        "--index",
        "1",
        "--buffer-meters",
        "20"
      ])
    ).toThrow(/does not accept --buffer-meters or --timeout-seconds/i);
  });

  it("throws INVALID_FLAG_COMBINATION code for mixed layer flags", () => {
    try {
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "runs",
        "--search-limit",
        "3"
      ]);
      throw new Error("Expected parseResortUpdateOptions to throw.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CliCommandError);
      const commandError = error as CliCommandError;
      expect(commandError.code).toBe("INVALID_FLAG_COMBINATION");
    }
  });

  it("rejects layer all without boundary index in non-dry-run mode", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "all"
      ])
    ).toThrow(/requires --index/i);
  });

  it("rejects layer all with --output", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "all",
        "--index",
        "1",
        "--output",
        "/tmp/file.geojson"
      ])
    ).toThrow(/does not accept --output/i);
  });
});

describe("resort-update command behavior", () => {
  it("prints text batch summary for --layer all", async () => {
    const log = vi.fn();
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: true,
      issues: [],
      results: [
        {
          workspacePath: "/tmp/resort.json",
          layer: "boundary",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/boundary.geojson",
            featureCount: 1,
            checksumSha256: "sha-b",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "boundary" }
        },
        {
          workspacePath: "/tmp/resort.json",
          layer: "lifts",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/lifts.geojson",
            featureCount: 10,
            checksumSha256: "sha-l",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "lifts" }
        },
        {
          workspacePath: "/tmp/resort.json",
          layer: "runs",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/runs.geojson",
            featureCount: 22,
            checksumSha256: "sha-r",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "runs" }
        }
      ]
    });

    await runResortUpdateCommand(
      ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1"],
      false,
      { updateResortLayersFn, log }
    );

    expect(log).toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toMatch(/RESORT_UPDATED_BATCH workspace=\/tmp\/resort.json/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/boundary changed=yes ready=yes/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/lifts changed=yes ready=yes/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/runs changed=yes ready=yes/);
  });

  it("throws UPDATE_INCOMPLETE for --layer all with --require-complete in text mode", async () => {
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: false,
      issues: ["runs: featureCount must be >= 1"],
      results: []
    });

    await expect(
      runResortUpdateCommand(
        ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1", "--require-complete"],
        false,
        { updateResortLayersFn, log: vi.fn() }
      )
    ).rejects.toMatchObject({ code: "UPDATE_INCOMPLETE" });
  });

  it("throws UPDATE_INCOMPLETE for --layer all with --require-complete in JSON mode", async () => {
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: false,
      issues: ["runs: featureCount must be >= 1"],
      results: []
    });

    await expect(
      runResortUpdateCommand(
        ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1", "--require-complete"],
        true,
        { updateResortLayersFn, log: vi.fn() }
      )
    ).rejects.toMatchObject({ code: "UPDATE_INCOMPLETE" });
  });
});
