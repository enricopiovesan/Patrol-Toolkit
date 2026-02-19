import { describe, expect, it } from "vitest";
import { CliCommandError, formatCliError, isCliEntryPointUrl, parseResortUpdateOptions } from "./cli.js";

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
