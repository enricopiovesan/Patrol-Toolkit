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
import { searchResortCandidates } from "./resort-search.js";
import { selectResortToWorkspace } from "./resort-select.js";
import { detectResortBoundaryCandidates } from "./resort-boundary-detect.js";
import { setResortBoundary } from "./resort-boundary-set.js";
import { syncResortLifts } from "./resort-sync-lifts.js";
import { syncResortRuns } from "./resort-sync-runs.js";
import { readResortSyncStatus } from "./resort-sync-status.js";

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
    command !== "resort-search" &&
    command !== "resort-select" &&
    command !== "resort-boundary-detect" &&
    command !== "resort-boundary-set" &&
    command !== "resort-sync-lifts" &&
    command !== "resort-sync-runs" &&
    command !== "resort-sync-status" &&
    command !== "extract-resort" &&
    command !== "extract-fleet"
  ) {
    throw new CliCommandError("UNKNOWN_COMMAND", `Unknown command '${command}'.`, {
      allowed: [
        "validate-pack",
        "summarize-pack",
        "ingest-osm",
        "build-pack",
        "resort-search",
        "resort-select",
        "resort-boundary-detect",
        "resort-boundary-set",
        "resort-sync-lifts",
        "resort-sync-runs",
        "resort-sync-status",
        "extract-resort",
        "extract-fleet"
      ]
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

  if (command === "resort-search") {
    const name = readFlag(args, "--name");
    const country = readFlag(args, "--country");
    const limit = readIntegerFlag(args, "--limit") ?? 5;
    if (!name || !country) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --name <value> and --country <value> arguments.", {
        command: "resort-search",
        required: ["--name", "--country"]
      });
    }
    if (limit < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --limit expects an integer >= 1.", {
        flag: "--limit",
        expected: "integer>=1",
        value: String(limit)
      });
    }

    const result = await searchResortCandidates({ name, country, limit });
    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          search: result
        })
      );
      return;
    }

    console.log(`RESORT_SEARCH name="${name}" country="${country}" results=${result.candidates.length}`);
    for (let index = 0; index < result.candidates.length; index += 1) {
      const candidate = result.candidates[index];
      if (!candidate) {
        continue;
      }
      const [lon, lat] = candidate.center;
      console.log(
        `${index + 1}. ${candidate.displayName} [${candidate.osmType}/${candidate.osmId}] @ ${lat.toFixed(5)},${lon.toFixed(5)}`
      );
    }
    return;
  }

  if (command === "resort-select") {
    const workspacePath = readFlag(args, "--workspace");
    const name = readFlag(args, "--name");
    const country = readFlag(args, "--country");
    const index = readIntegerFlag(args, "--index");
    const limit = readIntegerFlag(args, "--limit") ?? 5;
    const selectedAt = readFlag(args, "--selected-at") ?? undefined;
    if (!workspacePath || !name || !country || index === undefined) {
      throw new CliCommandError(
        "MISSING_REQUIRED_FLAGS",
        "Missing required --workspace <path> --name <value> --country <value> and --index <n> arguments.",
        {
          command: "resort-select",
          required: ["--workspace", "--name", "--country", "--index"]
        }
      );
    }
    if (index < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --index expects an integer >= 1.", {
        flag: "--index",
        expected: "integer>=1",
        value: String(index)
      });
    }
    if (limit < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --limit expects an integer >= 1.", {
        flag: "--limit",
        expected: "integer>=1",
        value: String(limit)
      });
    }

    let result;
    try {
      result = await selectResortToWorkspace({
        workspacePath,
        name,
        country,
        index,
        limit,
        selectedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("SELECTION_FAILED", message, {
        command: "resort-select",
        index,
        limit
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          selection: {
            workspacePath: result.workspacePath,
            selectedIndex: result.selectedIndex,
            candidateCount: result.candidateCount,
            selected: result.selected
          }
        })
      );
      return;
    }

    const [lon, lat] = result.selected.center;
    console.log(
      `RESORT_SELECTED index=${result.selectedIndex}/${result.candidateCount} workspace=${result.workspacePath} ${result.selected.displayName} [${result.selected.osmType}/${result.selected.osmId}] @ ${lat.toFixed(5)},${lon.toFixed(5)}`
    );
    return;
  }

  if (command === "resort-boundary-detect") {
    const workspacePath = readFlag(args, "--workspace");
    const searchLimit = readIntegerFlag(args, "--search-limit") ?? 5;
    if (!workspacePath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> argument.", {
        command: "resort-boundary-detect",
        required: ["--workspace"]
      });
    }
    if (searchLimit < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --search-limit expects an integer >= 1.", {
        flag: "--search-limit",
        expected: "integer>=1",
        value: String(searchLimit)
      });
    }

    let result;
    try {
      result = await detectResortBoundaryCandidates({
        workspacePath,
        searchLimit
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("BOUNDARY_DETECTION_FAILED", message, {
        command: "resort-boundary-detect",
        workspacePath
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          boundaryDetection: result
        })
      );
      return;
    }

    console.log(`BOUNDARY_CANDIDATES workspace=${result.workspacePath} count=${result.candidates.length}`);
    for (let index = 0; index < result.candidates.length; index += 1) {
      const candidate = result.candidates[index];
      if (!candidate) {
        continue;
      }
      console.log(
        `${index + 1}. ${candidate.displayName} [${candidate.osmType}/${candidate.osmId}] score=${candidate.validation.score} containsCenter=${candidate.validation.containsSelectionCenter ? "yes" : "no"} type=${candidate.geometryType ?? "none"}`
      );
    }
    return;
  }

  if (command === "resort-boundary-set") {
    const workspacePath = readFlag(args, "--workspace");
    const index = readIntegerFlag(args, "--index");
    const output = readFlag(args, "--output") ?? undefined;
    const selectedAt = readFlag(args, "--selected-at") ?? undefined;
    const searchLimit = readIntegerFlag(args, "--search-limit") ?? undefined;
    if (!workspacePath || index === undefined) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> and --index <n> arguments.", {
        command: "resort-boundary-set",
        required: ["--workspace", "--index"]
      });
    }
    if (index < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --index expects an integer >= 1.", {
        flag: "--index",
        expected: "integer>=1",
        value: String(index)
      });
    }
    if (searchLimit !== undefined && searchLimit < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --search-limit expects an integer >= 1.", {
        flag: "--search-limit",
        expected: "integer>=1",
        value: String(searchLimit)
      });
    }

    let result;
    try {
      result = await setResortBoundary({
        workspacePath,
        index,
        outputFile: output,
        selectedAt,
        searchLimit
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("BOUNDARY_SET_FAILED", message, {
        command: "resort-boundary-set",
        workspacePath,
        index
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          boundarySelection: result
        })
      );
      return;
    }

    console.log(
      `BOUNDARY_SELECTED index=${result.selectedIndex}/${result.candidateCount} workspace=${result.workspacePath} boundary=${result.boundaryPath} checksum=${result.checksumSha256} [${result.selectedOsm.osmType}/${result.selectedOsm.osmId}] ${result.selectedOsm.displayName}`
    );
    return;
  }

  if (command === "resort-sync-lifts") {
    const workspacePath = readFlag(args, "--workspace");
    const output = readFlag(args, "--output") ?? undefined;
    const bufferMeters = readNumberFlag(args, "--buffer-meters");
    const timeoutSeconds = readIntegerFlag(args, "--timeout-seconds");
    const updatedAt = readFlag(args, "--updated-at") ?? undefined;
    if (!workspacePath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> argument.", {
        command: "resort-sync-lifts",
        required: ["--workspace"]
      });
    }
    if (bufferMeters !== undefined && bufferMeters < 0) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --buffer-meters expects a number >= 0.", {
        flag: "--buffer-meters",
        expected: "number>=0",
        value: String(bufferMeters)
      });
    }
    if (timeoutSeconds !== undefined && timeoutSeconds < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --timeout-seconds expects an integer >= 1.", {
        flag: "--timeout-seconds",
        expected: "integer>=1",
        value: String(timeoutSeconds)
      });
    }

    let result;
    try {
      result = await syncResortLifts({
        workspacePath,
        outputPath: output,
        bufferMeters,
        timeoutSeconds,
        updatedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("LIFTS_SYNC_FAILED", message, {
        command: "resort-sync-lifts",
        workspacePath
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          liftSync: result
        })
      );
      return;
    }

    console.log(
      `LIFTS_SYNCED workspace=${result.workspacePath} lifts=${result.liftCount} output=${result.outputPath} checksum=${result.checksumSha256}`
    );
    return;
  }

  if (command === "resort-sync-runs") {
    const workspacePath = readFlag(args, "--workspace");
    const output = readFlag(args, "--output") ?? undefined;
    const bufferMeters = readNumberFlag(args, "--buffer-meters");
    const timeoutSeconds = readIntegerFlag(args, "--timeout-seconds");
    const updatedAt = readFlag(args, "--updated-at") ?? undefined;
    if (!workspacePath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> argument.", {
        command: "resort-sync-runs",
        required: ["--workspace"]
      });
    }
    if (bufferMeters !== undefined && bufferMeters < 0) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --buffer-meters expects a number >= 0.", {
        flag: "--buffer-meters",
        expected: "number>=0",
        value: String(bufferMeters)
      });
    }
    if (timeoutSeconds !== undefined && timeoutSeconds < 1) {
      throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --timeout-seconds expects an integer >= 1.", {
        flag: "--timeout-seconds",
        expected: "integer>=1",
        value: String(timeoutSeconds)
      });
    }

    let result;
    try {
      result = await syncResortRuns({
        workspacePath,
        outputPath: output,
        bufferMeters,
        timeoutSeconds,
        updatedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("RUNS_SYNC_FAILED", message, {
        command: "resort-sync-runs",
        workspacePath
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          runSync: result
        })
      );
      return;
    }

    console.log(
      `RUNS_SYNCED workspace=${result.workspacePath} runs=${result.runCount} output=${result.outputPath} checksum=${result.checksumSha256}`
    );
    return;
  }

  if (command === "resort-sync-status") {
    const workspacePath = readFlag(args, "--workspace");
    if (!workspacePath) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> argument.", {
        command: "resort-sync-status",
        required: ["--workspace"]
      });
    }

    let result;
    try {
      result = await readResortSyncStatus(workspacePath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("SYNC_STATUS_FAILED", message, {
        command: "resort-sync-status",
        workspacePath
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          syncStatus: result
        })
      );
      return;
    }

    console.log(`SYNC_STATUS workspace=${result.workspacePath} overall=${result.overall}`);
    console.log(
      `  boundary status=${result.layers.boundary.status} ready=${result.layers.boundary.ready} features=${result.layers.boundary.featureCount ?? "?"}`
    );
    console.log(
      `  lifts status=${result.layers.lifts.status} ready=${result.layers.lifts.ready} features=${result.layers.lifts.featureCount ?? "?"}`
    );
    console.log(
      `  runs status=${result.layers.runs.status} ready=${result.layers.runs.ready} features=${result.layers.runs.featureCount ?? "?"}`
    );
    if (result.issues.length > 0) {
      console.log("  issues:");
      for (const issue of result.issues) {
        console.log(`    - ${issue}`);
      }
    }
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
    `ptk-extractor commands:\n\n  validate-pack --input <path> [--json]\n  summarize-pack --input <path> [--json]\n  ingest-osm --input <path> --output <path> [--resort-id <id>] [--resort-name <name>] [--boundary-relation-id <id>] [--bbox <minLon,minLat,maxLon,maxLat>] [--json]\n  build-pack --input <normalized.json> --output <pack.json> --report <report.json> --timezone <IANA> --pmtiles-path <path> --style-path <path> [--lift-proximity-meters <n>] [--allow-outside-boundary] [--generated-at <ISO-8601>] [--json]\n  resort-search --name <value> --country <value> [--limit <n>] [--json]\n  resort-select --workspace <path> --name <value> --country <value> --index <n> [--limit <n>] [--selected-at <ISO-8601>] [--json]\n  resort-boundary-detect --workspace <path> [--search-limit <n>] [--json]\n  resort-boundary-set --workspace <path> --index <n> [--output <path>] [--search-limit <n>] [--selected-at <ISO-8601>] [--json]\n  resort-sync-lifts --workspace <path> [--output <path>] [--buffer-meters <n>] [--timeout-seconds <n>] [--updated-at <ISO-8601>] [--json]\n  resort-sync-runs --workspace <path> [--output <path>] [--buffer-meters <n>] [--timeout-seconds <n>] [--updated-at <ISO-8601>] [--json]\n  resort-sync-status --workspace <path> [--json]\n  extract-resort --config <config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]\n  extract-fleet --config <fleet-config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]`
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
