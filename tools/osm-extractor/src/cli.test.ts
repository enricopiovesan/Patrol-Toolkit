import { describe, expect, it } from "vitest";
import { CliCommandError, formatCliError, isCliEntryPointUrl } from "./cli.js";

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
