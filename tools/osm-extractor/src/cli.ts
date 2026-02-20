#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
import { updateResortLayers, type ResortUpdateBatchResult, type ResortUpdateLayerSelection } from "./resort-update.js";
import { runInteractiveMenu } from "./menu.js";

type CliErrorJson = {
  ok: false;
  error: {
    command: string | null;
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ResortUpdateCliOptions = {
  workspacePath: string;
  layer: ResortUpdateLayerSelection;
  outputPath?: string;
  index?: number;
  searchLimit?: number;
  bufferMeters?: number;
  timeoutSeconds?: number;
  updatedAt?: string;
  dryRun: boolean;
  requireComplete: boolean;
};

type ResortWorkspaceLayerStateLike = {
  status?: "pending" | "running" | "complete" | "failed";
  artifactPath?: string;
  featureCount?: number;
  checksumSha256?: string;
  updatedAt?: string;
  error?: string;
};

type ResortWorkspaceLike = {
  schemaVersion?: string;
  resort?: {
    query?: {
      name?: string;
      country?: string;
    };
    selection?: {
      osmType?: "relation" | "way" | "node";
      osmId?: number;
      displayName?: string;
      center?: [number, number];
      selectedAt?: string;
    };
  };
  layers?: {
    boundary?: ResortWorkspaceLayerStateLike;
    lifts?: ResortWorkspaceLayerStateLike;
    runs?: ResortWorkspaceLayerStateLike;
  };
};

type ResortStatusLike = {
  schemaVersion?: string;
  resortKey?: string;
  version?: string;
  createdAt?: string;
  readiness?: {
    overall?: "ready" | "incomplete";
    issues?: string[];
  };
  manualValidation?: {
    validated?: boolean;
    validatedAt?: string | null;
    validatedBy?: string | null;
    notes?: string | null;
  };
};

export type ResortExportLatestResult = {
  resortsRoot: string;
  resortKey: string;
  version: string;
  validatedAt: string | null;
  outputPath: string;
  exportedAt: string;
};

export type ResortPublishLatestResult = {
  resortKey: string;
  version: string;
  outputPath: string;
  outputUrl: string;
  catalogPath: string;
  exportedAt: string;
  basemapPmtilesPath: string;
  basemapStylePath: string;
};

type ResortCatalogIndex = {
  schemaVersion: "1.0.0";
  resorts: ResortCatalogEntry[];
};

type ResortCatalogEntry = {
  resortId: string;
  resortName: string;
  versions: ResortCatalogVersion[];
};

type ResortCatalogVersion = {
  version: string;
  approved: boolean;
  packUrl: string;
  createdAt: string;
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

type ResortUpdateCommandDeps = {
  updateResortLayersFn?: typeof updateResortLayers;
  log?: (line: string) => void;
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const outputJson = hasFlag(args, "--json");

  if (!command) {
    const resortsRoot = readFlag(args, "--resorts-root") ?? "./resorts";
    const appPublicRoot = readFlag(args, "--app-public-root") ?? "./public";
    await runInteractiveMenu({
      resortsRoot,
      appPublicRoot,
      searchFn: searchResortCandidates
    });
    return;
  }

  if (command === "help" || command === "--help") {
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
    command !== "resort-update" &&
    command !== "resort-export-latest" &&
    command !== "resort-publish-latest" &&
    command !== "menu" &&
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
        "resort-update",
        "resort-export-latest",
        "resort-publish-latest",
        "menu",
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
        `${index + 1}. ${candidate.displayName} [${candidate.osmType}/${candidate.osmId}] score=${candidate.validation.score} containsCenter=${candidate.validation.containsSelectionCenter ? "yes" : "no"} distanceKm=${candidate.validation.distanceToSelectionCenterKm.toFixed(1)} type=${candidate.geometryType ?? "none"} why=${candidate.validation.signals.slice(0, 3).join(",") || "none"}`
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

  if (command === "resort-update") {
    await runResortUpdateCommand(args, outputJson);
    return;
  }

  if (command === "resort-export-latest") {
    const resortsRoot = readFlag(args, "--resorts-root") ?? "./resorts";
    const resortKey = readFlag(args, "--resort-key");
    const outputPath = readFlag(args, "--output");
    const exportedAt = readFlag(args, "--exported-at") ?? undefined;
    if (!resortKey || !outputPath) {
      throw new CliCommandError(
        "MISSING_REQUIRED_FLAGS",
        "Missing required --resort-key <value> and --output <path> arguments.",
        {
          command: "resort-export-latest",
          required: ["--resort-key", "--output"]
        }
      );
    }

    let result: ResortExportLatestResult;
    try {
      result = await exportLatestValidatedResortVersion({
        resortsRoot,
        resortKey,
        outputPath,
        exportedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("RESORT_EXPORT_FAILED", message, {
        command: "resort-export-latest",
        resortsRoot,
        resortKey,
        outputPath
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          resortExport: result
        })
      );
      return;
    }

    console.log(
      `RESORT_EXPORTED resortKey=${result.resortKey} version=${result.version} validatedAt=${result.validatedAt ?? "n/a"} output=${result.outputPath}`
    );
    return;
  }

  if (command === "resort-publish-latest") {
    const resortsRoot = readFlag(args, "--resorts-root") ?? "./resorts";
    const appPublicRoot = readFlag(args, "--app-public-root") ?? "./public";
    const resortKey = readFlag(args, "--resort-key");
    const exportedAt = readFlag(args, "--exported-at") ?? undefined;
    if (!resortKey) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --resort-key <value> argument.", {
        command: "resort-publish-latest",
        required: ["--resort-key"]
      });
    }

    let result: ResortPublishLatestResult;
    try {
      result = await publishLatestValidatedResortVersion({
        resortsRoot,
        appPublicRoot,
        resortKey,
        exportedAt
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliCommandError("RESORT_PUBLISH_FAILED", message, {
        command: "resort-publish-latest",
        resortsRoot,
        appPublicRoot,
        resortKey
      });
    }

    if (outputJson) {
      console.log(
        JSON.stringify({
          ok: true,
          resortPublish: result
        })
      );
      return;
    }

    console.log(
      `RESORT_PUBLISHED resortKey=${result.resortKey} version=${result.version} output=${result.outputPath} catalog=${result.catalogPath}`
    );
    return;
  }

  if (command === "menu") {
    const resortsRoot = readFlag(args, "--resorts-root") ?? "./resorts";
    const appPublicRoot = readFlag(args, "--app-public-root") ?? "./public";
    await runInteractiveMenu({
      resortsRoot,
      appPublicRoot,
      searchFn: searchResortCandidates
    });
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

export function parseResortUpdateOptions(args: string[]): ResortUpdateCliOptions {
  const workspacePath = readFlag(args, "--workspace");
  const layerRaw = readFlag(args, "--layer");
  const outputPath = readFlag(args, "--output") ?? undefined;
  const index = readIntegerFlag(args, "--index");
  const searchLimit = readIntegerFlag(args, "--search-limit");
  const bufferMeters = readNumberFlag(args, "--buffer-meters");
  const timeoutSeconds = readIntegerFlag(args, "--timeout-seconds");
  const updatedAt = readFlag(args, "--updated-at") ?? undefined;
  const dryRun = hasFlag(args, "--dry-run");
  const requireComplete = hasFlag(args, "--require-complete");

  if (!workspacePath || !layerRaw) {
    throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Missing required --workspace <path> and --layer <boundary|lifts|runs|all> arguments.", {
      command: "resort-update",
      required: ["--workspace", "--layer"]
    });
  }
  if (layerRaw !== "boundary" && layerRaw !== "lifts" && layerRaw !== "runs" && layerRaw !== "all") {
    throw new CliCommandError("INVALID_FLAG_VALUE", "Flag --layer expects one of: boundary, lifts, runs, all.", {
      flag: "--layer",
      expected: "boundary|lifts|runs|all",
      value: layerRaw
    });
  }

  const layer = layerRaw as ResortUpdateLayerSelection;
  if (index !== undefined && index < 1) {
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

  if (layer === "boundary") {
    if (index === undefined) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Boundary update requires --index <n>.", {
        command: "resort-update",
        required: ["--index"]
      });
    }
    if (bufferMeters !== undefined || timeoutSeconds !== undefined) {
      throw new CliCommandError(
        "INVALID_FLAG_COMBINATION",
        "Boundary update does not accept --buffer-meters or --timeout-seconds. Use --search-limit and --index.",
        {
          command: "resort-update",
          layer,
          invalid: ["--buffer-meters", "--timeout-seconds"]
        }
      );
    }
  }

  if ((layer === "lifts" || layer === "runs") && (index !== undefined || searchLimit !== undefined)) {
    throw new CliCommandError(
      "INVALID_FLAG_COMBINATION",
      "Lifts/runs update does not accept --index or --search-limit. These flags are boundary-only.",
      {
        command: "resort-update",
        layer,
        invalid: ["--index", "--search-limit"]
      }
    );
  }

  if (layer === "all") {
    if (!dryRun && index === undefined) {
      throw new CliCommandError("MISSING_REQUIRED_FLAGS", "Layer 'all' update requires --index <n> for boundary selection.", {
        command: "resort-update",
        required: ["--index"]
      });
    }
    if (outputPath !== undefined) {
      throw new CliCommandError(
        "INVALID_FLAG_COMBINATION",
        "Layer 'all' does not accept --output because each layer writes its own artifact path.",
        {
          command: "resort-update",
          layer,
          invalid: ["--output"]
        }
      );
    }
  }

  return {
    workspacePath,
    layer,
    outputPath,
    index,
    searchLimit,
    bufferMeters,
    timeoutSeconds,
    updatedAt,
    dryRun,
    requireComplete
  };
}

export async function runResortUpdateCommand(
  args: string[],
  outputJson: boolean,
  deps?: ResortUpdateCommandDeps
): Promise<void> {
  const updateOptions = parseResortUpdateOptions(args);
  const updateResortLayersFn = deps?.updateResortLayersFn ?? updateResortLayers;
  const log = deps?.log ?? console.log;

  let result: ResortUpdateBatchResult;
  try {
    result = await updateResortLayersFn({
      workspacePath: updateOptions.workspacePath,
      layer: updateOptions.layer,
      index: updateOptions.index,
      outputPath: updateOptions.outputPath,
      searchLimit: updateOptions.searchLimit,
      bufferMeters: updateOptions.bufferMeters,
      timeoutSeconds: updateOptions.timeoutSeconds,
      updatedAt: updateOptions.updatedAt,
      dryRun: updateOptions.dryRun
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliCommandError("RESORT_UPDATE_FAILED", message, {
      command: "resort-update",
      workspacePath: updateOptions.workspacePath,
      layer: updateOptions.layer
    });
  }

  if (updateOptions.requireComplete && !result.overallReady) {
    if (result.results.length === 1) {
      const only = result.results[0];
      if (only && !only.readiness.ready) {
        throw new CliCommandError(
          "UPDATE_INCOMPLETE",
          `Layer '${only.layer}' is not complete after update.`,
          {
            workspacePath: result.workspacePath,
            layer: only.layer,
            issues: only.readiness.issues
          }
        );
      }
    }
    throw new CliCommandError("UPDATE_INCOMPLETE", "One or more layers are not complete after update.", {
      workspacePath: result.workspacePath,
      layerSelection: result.layerSelection,
      issues: result.issues
    });
  }

  if (outputJson) {
    log(
      JSON.stringify({
        ok: true,
        resortUpdate: result.results.length === 1 ? result.results[0] : result
      })
    );
    return;
  }

  if (result.results.length === 1) {
    const only = result.results[0];
    if (only) {
      log(
        `RESORT_UPDATED workspace=${only.workspacePath} layer=${only.layer} dryRun=${only.dryRun ? "yes" : "no"} changed=${only.changed ? "yes" : "no"} fields=${
          only.changedFields.length > 0 ? only.changedFields.join(",") : "none"
        } ready=${only.readiness.ready ? "yes" : "no"} features=${only.after.featureCount ?? "?"} output=${
          only.after.artifactPath ?? "?"
        }`
      );
      if (only.readiness.issues.length > 0) {
        log("  readiness issues:");
        for (const issue of only.readiness.issues) {
          log(`    - ${issue}`);
        }
      }
    }
    return;
  }

  log(
    `RESORT_UPDATED_BATCH workspace=${result.workspacePath} layers=boundary,lifts,runs dryRun=${result.dryRun ? "yes" : "no"} ready=${
      result.overallReady ? "yes" : "no"
    }`
  );
  for (const layerResult of result.results) {
    log(
      `  ${layerResult.layer} changed=${layerResult.changed ? "yes" : "no"} ready=${
        layerResult.readiness.ready ? "yes" : "no"
      } features=${layerResult.after.featureCount ?? "?"}`
    );
    for (const issue of layerResult.readiness.issues) {
      log(`    - ${issue}`);
    }
  }
}

export async function exportLatestValidatedResortVersion(args: {
  resortsRoot: string;
  resortKey: string;
  outputPath: string;
  exportedAt?: string;
}): Promise<ResortExportLatestResult> {
  const resortPath = resolve(args.resortsRoot, args.resortKey);
  const versions = await readVersionFolders(resortPath);
  if (versions.length === 0) {
    throw new Error(`No versions found for resort '${args.resortKey}'.`);
  }

  const sorted = [...versions].sort((a, b) => b - a);
  let selectedVersion: number | null = null;
  let selectedStatus: ResortStatusLike | null = null;

  for (const version of sorted) {
    const versionPath = join(resortPath, `v${String(version)}`);
    const statusPath = join(versionPath, "status.json");
    const status = await readJsonFile<ResortStatusLike>(statusPath).catch(() => null);
    if (status?.manualValidation?.validated === true) {
      selectedVersion = version;
      selectedStatus = status;
      break;
    }
  }

  if (selectedVersion === null || !selectedStatus) {
    throw new Error(`No manually validated version found for resort '${args.resortKey}'.`);
  }

  const version = `v${String(selectedVersion)}`;
  const versionPath = join(resortPath, version);
  const workspacePath = join(versionPath, "resort.json");
  const workspace = await readJsonFile<ResortWorkspaceLike>(workspacePath);

  const boundary = await readLayerArtifactJson(versionPath, workspace.layers?.boundary?.artifactPath);
  const runs = await readLayerArtifactJson(versionPath, workspace.layers?.runs?.artifactPath);
  const lifts = await readLayerArtifactJson(versionPath, workspace.layers?.lifts?.artifactPath);

  const exportedAt = args.exportedAt ?? new Date().toISOString();
  const bundle = {
    schemaVersion: "1.0.0",
    export: {
      resortKey: args.resortKey,
      version,
      exportedAt
    },
    status: selectedStatus,
    workspace,
    layers: {
      boundary,
      runs,
      lifts
    }
  };

  const outputPath = resolve(args.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  return {
    resortsRoot: resolve(args.resortsRoot),
    resortKey: args.resortKey,
    version,
    validatedAt: selectedStatus.manualValidation?.validatedAt ?? null,
    outputPath,
    exportedAt
  };
}

export async function publishLatestValidatedResortVersion(args: {
  resortsRoot: string;
  appPublicRoot: string;
  resortKey: string;
  exportedAt?: string;
}): Promise<ResortPublishLatestResult> {
  const publicRoot = resolve(args.appPublicRoot);
  const packsDir = join(publicRoot, "packs");
  const catalogDir = join(publicRoot, "resort-packs");
  const outputFileName = `${args.resortKey}.latest.validated.json`;
  const outputPath = join(packsDir, outputFileName);
  const outputUrl = `/packs/${outputFileName}`;

  const exportResult = await exportLatestValidatedResortVersion({
    resortsRoot: args.resortsRoot,
    resortKey: args.resortKey,
    outputPath,
    exportedAt: args.exportedAt
  });
  const versionPath = join(resolve(args.resortsRoot), args.resortKey, exportResult.version);
  const basemapAssets = await publishBasemapAssetsForVersion({
    versionPath,
    publicRoot,
    resortKey: args.resortKey
  });

  const exportedBundle = await readJsonFile<{
    workspace?: {
      resort?: {
        query?: {
          name?: string;
        };
      };
    };
  }>(outputPath);

  const resortName = exportedBundle.workspace?.resort?.query?.name?.trim() || args.resortKey;
  const catalogPath = join(catalogDir, "index.json");

  await mkdir(catalogDir, { recursive: true });

  const catalog = await readCatalogIndex(catalogPath);
  const updatedResorts = catalog.resorts.filter((entry) => entry.resortId !== args.resortKey);
  updatedResorts.push({
    resortId: args.resortKey,
    resortName,
    versions: [
      {
        version: exportResult.version,
        approved: true,
        packUrl: outputUrl,
        createdAt: exportResult.exportedAt
      }
    ]
  });

  updatedResorts.sort((left, right) => left.resortName.localeCompare(right.resortName));
  const nextCatalog: ResortCatalogIndex = {
    schemaVersion: "1.0.0",
    resorts: updatedResorts
  };
  await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");

  return {
    resortKey: args.resortKey,
    version: exportResult.version,
    outputPath,
    outputUrl,
    catalogPath,
    exportedAt: exportResult.exportedAt,
    basemapPmtilesPath: basemapAssets.pmtilesDestinationPath,
    basemapStylePath: basemapAssets.styleDestinationPath
  };
}

async function publishBasemapAssetsForVersion(args: {
  versionPath: string;
  publicRoot: string;
  resortKey: string;
}): Promise<{ pmtilesDestinationPath: string; styleDestinationPath: string }> {
  const basemapSourceDir = join(args.versionPath, "basemap");
  const pmtilesSourcePath = join(basemapSourceDir, "base.pmtiles");
  const styleSourcePath = join(basemapSourceDir, "style.json");

  await assertRegularFile(pmtilesSourcePath, "Missing basemap PMTiles");
  await assertRegularFile(styleSourcePath, "Missing basemap style");
  await assertOfflineReadyBasemapAssets({
    pmtilesPath: pmtilesSourcePath,
    stylePath: styleSourcePath,
    label: "Basemap assets are not offline-ready"
  });

  const destinationDir = join(args.publicRoot, "packs", args.resortKey);
  const pmtilesDestinationPath = join(destinationDir, "base.pmtiles");
  const styleDestinationPath = join(destinationDir, "style.json");

  await mkdir(destinationDir, { recursive: true });
  await copyFile(pmtilesSourcePath, pmtilesDestinationPath);
  await copyFile(styleSourcePath, styleDestinationPath);

  return {
    pmtilesDestinationPath,
    styleDestinationPath
  };
}

async function assertOfflineReadyBasemapAssets(args: {
  pmtilesPath: string;
  stylePath: string;
  label: string;
}): Promise<void> {
  const pmtiles = await inspectPmtilesArchive(args.pmtilesPath);
  const style = await inspectOfflineStyle(args.stylePath);
  if (pmtiles.ok && style.ok) {
    return;
  }

  throw new Error(`${args.label}: ${[...pmtiles.issues, ...style.issues].join("; ")}`);
}

async function inspectPmtilesArchive(path: string): Promise<{ ok: boolean; issues: string[] }> {
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    return { ok: false, issues: [`missing PMTiles file (${path})`] };
  }

  if (!metadata.isFile()) {
    return { ok: false, issues: [`PMTiles path is not a file (${path})`] };
  }

  if (metadata.size <= 0) {
    return { ok: false, issues: [`PMTiles file is empty (${path})`] };
  }

  if (metadata.size === 3) {
    try {
      const bytes = await readFile(path);
      if (bytes[0] === 80 && bytes[1] === 84 && bytes[2] === 75) {
        return { ok: false, issues: [`PMTiles file is placeholder content (${path})`] };
      }
    } catch {
      return { ok: false, issues: [`Unable to read PMTiles file (${path})`] };
    }
  }

  return { ok: true, issues: [] };
}

async function inspectOfflineStyle(path: string): Promise<{ ok: boolean; issues: string[] }> {
  let parsed: unknown;
  try {
    const raw = await readFile(path, "utf8");
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, issues: [`Invalid basemap style JSON (${path})`] };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, issues: [`Basemap style must be an object (${path})`] };
  }

  const candidate = parsed as { sources?: unknown };
  if (typeof candidate.sources !== "object" || candidate.sources === null) {
    return { ok: false, issues: [`Basemap style missing sources (${path})`] };
  }

  const sources = candidate.sources as Record<string, { type?: unknown; url?: unknown; tiles?: unknown }>;
  let hasVectorSource = false;
  const issues: string[] = [];

  for (const source of Object.values(sources)) {
    if (!source || typeof source !== "object") {
      continue;
    }

    if (source.type === "vector") {
      hasVectorSource = true;
      if (typeof source.url === "string" && /^https?:\/\//iu.test(source.url.trim())) {
        issues.push("style vector source points to network URL");
      }
      continue;
    }

    if (source.type === "raster" && Array.isArray(source.tiles)) {
      const hasNetworkTiles = source.tiles.some(
        (entry) => typeof entry === "string" && /^https?:\/\//iu.test(entry.trim())
      );
      if (hasNetworkTiles) {
        issues.push("style raster source points to network tile URLs");
      }
    }
  }

  if (!hasVectorSource) {
    issues.push("style has no vector source for local PMTiles");
  }

  return { ok: issues.length === 0, issues: issues.map((issue) => `${issue} (${path})`) };
}

async function assertRegularFile(path: string, label: string): Promise<void> {
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    throw new Error(`${label}: ${path}`);
  }

  if (!metadata.isFile()) {
    throw new Error(`${label}: ${path}`);
  }
}

async function readLayerArtifactJson(versionPath: string, artifactPath: string | undefined): Promise<unknown | null> {
  if (!artifactPath || artifactPath.trim().length === 0) {
    return null;
  }
  const candidates = artifactPath.startsWith("/")
    ? [artifactPath]
    : [resolve(versionPath, artifactPath), resolve(artifactPath)];

  for (const candidate of candidates) {
    try {
      return await readJsonFile<unknown>(candidate);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function readVersionFolders(resortPath: string): Promise<number[]> {
  let entries;
  try {
    entries = await readdir(resortPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseVersionFolder(entry.name))
    .filter((value): value is number => value !== null);
}

function parseVersionFolder(name: string): number | null {
  const match = /^v([1-9]\d*)$/.exec(name);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

async function readCatalogIndex(path: string): Promise<ResortCatalogIndex> {
  try {
    const parsed = await readJsonFile<unknown>(path);
    if (!isCatalogIndex(parsed)) {
      return {
        schemaVersion: "1.0.0",
        resorts: []
      };
    }
    return parsed;
  } catch {
    return {
      schemaVersion: "1.0.0",
      resorts: []
    };
  }
}

function isCatalogIndex(input: unknown): input is ResortCatalogIndex {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const value = input as { schemaVersion?: unknown; resorts?: unknown };
  if (value.schemaVersion !== "1.0.0" || !Array.isArray(value.resorts)) {
    return false;
  }
  return value.resorts.every((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }
    const resort = entry as { resortId?: unknown; resortName?: unknown; versions?: unknown };
    if (typeof resort.resortId !== "string" || typeof resort.resortName !== "string" || !Array.isArray(resort.versions)) {
      return false;
    }
    return resort.versions.every((version) => {
      if (typeof version !== "object" || version === null) {
        return false;
      }
      const data = version as { version?: unknown; approved?: unknown; packUrl?: unknown; createdAt?: unknown };
      return (
        typeof data.version === "string" &&
        typeof data.approved === "boolean" &&
        typeof data.packUrl === "string" &&
        typeof data.createdAt === "string"
      );
    });
  });
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
    `ptk-extractor commands:\n\n  menu [--resorts-root <path>] [--app-public-root <path>]\n  validate-pack --input <path> [--json]\n  summarize-pack --input <path> [--json]\n  ingest-osm --input <path> --output <path> [--resort-id <id>] [--resort-name <name>] [--boundary-relation-id <id>] [--bbox <minLon,minLat,maxLon,maxLat>] [--json]\n  build-pack --input <normalized.json> --output <pack.json> --report <report.json> --timezone <IANA> --pmtiles-path <path> --style-path <path> [--lift-proximity-meters <n>] [--allow-outside-boundary] [--generated-at <ISO-8601>] [--json]\n  resort-search --name <value> --country <value> [--limit <n>] [--json]\n  resort-select --workspace <path> --name <value> --country <value> --index <n> [--limit <n>] [--selected-at <ISO-8601>] [--json]\n  resort-boundary-detect --workspace <path> [--search-limit <n>] [--json]\n  resort-boundary-set --workspace <path> --index <n> [--output <path>] [--search-limit <n>] [--selected-at <ISO-8601>] [--json]\n  resort-sync-lifts --workspace <path> [--output <path>] [--buffer-meters <n>] [--timeout-seconds <n>] [--updated-at <ISO-8601>] [--json]\n  resort-sync-runs --workspace <path> [--output <path>] [--buffer-meters <n>] [--timeout-seconds <n>] [--updated-at <ISO-8601>] [--json]\n  resort-sync-status --workspace <path> [--json]\n  resort-update --workspace <path> --layer <boundary|lifts|runs|all> [--index <n>] [--output <path>] [--search-limit <n>] [--buffer-meters <n>] [--timeout-seconds <n>] [--updated-at <ISO-8601>] [--dry-run] [--require-complete] [--json]\n  resort-export-latest --resort-key <value> --output <path> [--resorts-root <path>] [--exported-at <ISO-8601>] [--json]\n  resort-publish-latest --resort-key <value> [--resorts-root <path>] [--app-public-root <path>] [--exported-at <ISO-8601>] [--json]\n  extract-resort --config <config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]\n  extract-fleet --config <fleet-config.json> [--log-file <audit.jsonl>] [--generated-at <ISO-8601>] [--json]`
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
