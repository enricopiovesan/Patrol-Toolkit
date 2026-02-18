#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createAuditLogger, noopAuditLogger } from "./audit-log.js";
import { runExtractFleetPipeline } from "./fleet-run.js";
import { toBuildPackJson, toExtractFleetJson, toExtractResortJson, toIngestOsmJson } from "./extraction-result.js";
import { ingestOsmToFile } from "./osm-ingest.js";
import { buildPackToFile } from "./pack-build.js";
import { readPack, summarizePack, summarizePackData, validatePack } from "./pack-validate.js";
import { runExtractResortPipeline } from "./pipeline-run.js";

type CliErrorJson = {
  ok: false;
  error: {
    command: string | null;
    code: string;
    message: string;
    details?: unknown;
  };
};

export class CliCommandError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const outputJson = hasFlag(args, "--json");

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (
    command !== "validate-pack" &&
    command !== "summarize-pack" &&
    command !== "ingest-osm" &&
    command !== "build-pack" &&
    command !== "extract-resort" &&
    command !== "extract-fleet"
  ) {
    throw new CliCommandError("UNKNOWN_COMMAND", `Unknown command '${command}'.`, {
      allowed: ["validate-pack", "summarize-pack", "ingest-osm", "build-pack", "extract-resort", "extract-fleet"]
    });
  }

  if (command === "ingest-osm") {
    const input = readFlag(args, "--input");
    const output = readFlag(args, "--output");
    if (!input || !output) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --input <path> and --output <path> arguments.", {
        command: "ingest-osm",
        required: ["--input", "--output"]
      });
    }

    const resortId = readFlag(args, "--resort-id") ?? undefined;
    const resortName = readFlag(args, "--resort-name") ?? undefined;
    const boundaryRelationId = readIntegerFlag(args, "--boundary-relation-id");
    const bbox = readBboxFlag(args, "--bbox");

    const result = await ingestOsmToFile({
      inputPath: input,
      outputPath: output,
      resortId,
      resortName,
      boundaryRelationId,
      bbox
    });

    if (outputJson) {
      console.log(JSON.stringify(toIngestOsmJson(result)));
      return;
    }

    console.log(
      `INGESTED resort=${result.resort.id} lifts=${result.lifts.length} runs=${result.runs.length} boundary=${
        result.boundary ? "yes" : "no"
      } warnings=${result.warnings.length}`
    );
    return;
  }

  if (command === "build-pack") {
    const input = readFlag(args, "--input");
    const output = readFlag(args, "--output");
    const report = readFlag(args, "--report");
    const timezone = readFlag(args, "--timezone");
    const pmtilesPath = readFlag(args, "--pmtiles-path");
    const stylePath = readFlag(args, "--style-path");
    const liftProximityMeters = readNumberFlag(args, "--lift-proximity-meters");
    const allowOutsideBoundary = hasFlag(args, "--allow-outside-boundary");
    const generatedAt = readFlag(args, "--generated-at") ?? undefined;

    if (!input || !output || !report || !timezone || !pmtilesPath || !stylePath) {
      throw new CliCommandError(
        "MISSING_REQUIRED_FLAGS",
        "Missing required flags. build-pack needs --input --output --report --timezone --pmtiles-path --style-path.",
        {
          command: "build-pack",
          required: ["--input", "--output", "--report", "--timezone", "--pmtiles-path", "--style-path"]
        }
      );
    }

    const result = await buildPackToFile({
      inputPath: input,
      outputPath: output,
      reportPath: report,
      timezone,
      pmtilesPath,
      stylePath,
      liftProximityMeters,
      allowOutsideBoundary,
      generatedAt
    });

    if (outputJson) {
      console.log(
        JSON.stringify(
          toBuildPackJson({
            pack: result.pack,
            report: result.report,
            packPath: output,
            reportPath: report
          })
        )
      );
      return;
    }

    console.log(
      `PACK_BUILT resort=${result.pack.resort.id} runs=${result.pack.runs.length} lifts=${result.pack.lifts.length} boundaryGate=${result.report.boundaryGate.status}`
    );
    return;
  }

  if (command === "extract-resort") {
    const configPath = readFlag(args, "--config");
    const logFile = readFlag(args, "--log-file");
    const generatedAt = readFlag(args, "--generated-at") ?? undefined;
    if (!configPath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --config <path> argument.", {
        command: "extract-resort",
        required: ["--config"]
      });
    }

    const logger = logFile ? await createAuditLogger(logFile) : noopAuditLogger;
    const result = await runExtractResortPipeline(configPath, { logger, generatedAt });
    if (outputJson) {
      console.log(JSON.stringify(toExtractResortJson(result)));
      return;
    }
    console.log(
      `EXTRACTED resort=${result.resortId} runs=${result.runCount} lifts=${result.liftCount} boundaryGate=${result.boundaryGate} pack=${result.packPath} provenance=${result.provenancePath}`
    );
    return;
  }

  if (command === "extract-fleet") {
    const configPath = readFlag(args, "--config");
    const logFile = readFlag(args, "--log-file");
    const generatedAt = readFlag(args, "--generated-at") ?? undefined;
    if (!configPath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --config <path> argument.", {
        command: "extract-fleet",
        required: ["--config"]
      });
    }

    const logger = logFile ? await createAuditLogger(logFile) : noopAuditLogger;
    const result = await runExtractFleetPipeline(configPath, { logger, generatedAt });
    if (outputJson) {
      console.log(
        JSON.stringify(
          toExtractFleetJson({
            manifest: result.manifest,
            manifestPath: result.manifestPath,
            provenancePath: result.provenancePath
          })
        )
      );
      return;
    }
    console.log(
      `FLEET_EXTRACTED resorts=${result.manifest.fleetSize} success=${result.manifest.successCount} failed=${result.manifest.failureCount} manifest=${result.manifestPath} provenance=${result.provenancePath}`
    );
    return;
  }

  const input = readFlag(args, "--input");
  if (!input) {
    throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --input <path> argument.", {
      command,
      required: ["--input"]
    });
  }

  const data = await readPack(input);
  const result = validatePack(data);

  if (!result.ok) {
    if (outputJson && command === "validate-pack") {
      throw new CliCommandError("PACK_VALIDATION_FAILED", "Pack validation failed.", {
        issues: result.issues
      });
    }
    throw new Error(`Invalid Resort Pack:\n${result.errors.join("\n")}`);
  }

  if (command === "validate-pack") {
    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          resort: result.value.resort.id,
          schemaVersion: result.value.schemaVersion
        })
      );
      return;
    }
    console.log("VALID");
    return;
  }

  if (command === "summarize-pack" && outputJson) {
    console.log(
      JSON.stringify({
        ok: true,
        summary: summarizePackData(result.value)
      })
    );
    return;
  }

  console.log(summarizePack(result.value));
}

function readFlag(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function readIntegerFlag(args: string[], flag: string): number | undefined {
  const value = readFlag(args, flag);
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CliCommandError("INVALID_FLAG_VALUE", `Flag ${flag} expects an integer value.`, {
      flag,
      expected: "integer",
      value
    });
  }
  return parsed;
}

function readNumberFlag(args: string[], flag: string): number | undefined {
  const value = readFlag(args, flag);
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliCommandError("INVALID_FLAG_VALUE", `Flag ${flag} expects a numeric value.`, {
      flag,
      expected: "number",
      value
    });
  }
  return parsed;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function readBboxFlag(args: string[], flag: string): [number, number, number, number] | undefined {
  const value = readFlag(args, flag);
  if (value === null) {
    return undefined;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new CliCommandError(
      "INVALID_FLAG_VALUE",
      `Flag ${flag} expects four comma-separated numbers: minLon,minLat,maxLon,maxLat`,
      {
        flag,
        expected: "bbox(minLon,minLat,maxLon,maxLat)",
        value
      }
    );
  }

  const [minLon, minLat, maxLon, maxLat] = parts;
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
    throw new CliCommandError("INVALID_FLAG_VALUE", `Flag ${flag} expects four numeric values.`, {
      flag,
      expected: "four-numbers",
      value
    });
  }
  if (minLon > maxLon || minLat > maxLat) {
    throw new CliCommandError("INVALID_FLAG_VALUE", `Flag ${flag} expects min values <= max values.`, {
      flag,
      expected: "min<=max",
      value
    });
  }

  return [minLon, minLat, maxLon, maxLat];
}

export function formatCliError(error: unknown, command: string | null): CliErrorJson {
  if (error instanceof CliCommandError) {
    return {
      ok: false,
      error: {
        command,
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    error: {
      command,
      code: "COMMAND_FAILED",
      message
    }
  };
}

function printHelp(): void {
  console.log(
    `ptk-extractor commands:\n\n  validate-pack --input <path> [--json]\n  summarize-pack --input <path> [--json]\n  ingest-osm --input <path> --output <path> [--resort-id <id>] [--resort-name <name>] [--boundary-relation-id <id>] [--bbox <minLon,minLat,maxLon,maxLat>] [--json]\n  build-pack --input <normalized.json> --output <pack.json> --report <report.json> --timezone <IANA> --pmtiles-path <path> --style-path <path> [--lift-proximity-meters <n>] [--allow-outside-boundary] [--generated-at <ISO-8601>] [--json]\n  extract-resort --config <config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]\n  extract-fleet --config <fleet-config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]`
  );
}

export function isCliEntryPointUrl(args: { importMetaUrl: string; entryPath: string | undefined }): boolean {
  if (!args.entryPath) {
    return false;
  }
  return args.importMetaUrl === pathToFileURL(resolve(args.entryPath)).href;
}

function isCliEntryPoint(): boolean {
  return isCliEntryPointUrl({
    importMetaUrl: import.meta.url,
    entryPath: process.argv[1]
  });
}

if (isCliEntryPoint()) {
  main().catch((error: unknown) => {
    const [command, ...args] = process.argv.slice(2);
    const outputJson = hasFlag(args, "--json");
    if (outputJson) {
      console.error(JSON.stringify(formatCliError(error, command ?? null)));
      process.exit(1);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
