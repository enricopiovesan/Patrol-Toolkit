import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { basename, dirname, join, resolve } from "node:path";
import { buildNominatimLookupUrl } from "./resort-boundary-detect.js";
import { detectResortBoundaryCandidates } from "./resort-boundary-detect.js";
import { searchResortCandidates } from "./resort-search.js";
import type { ResortSearchCandidate, ResortSearchResult } from "./resort-search.js";
import { readResortSyncStatus } from "./resort-sync-status.js";
import { setResortBoundary } from "./resort-boundary-set.js";
import { syncResortLifts } from "./resort-sync-lifts.js";
import { syncResortPeaks } from "./resort-sync-peaks.js";
import { syncResortContours } from "./resort-sync-contours.js";
import { syncResortRuns } from "./resort-sync-runs.js";
import type { ResortWorkspace } from "./resort-workspace.js";
import { readResortWorkspace, writeResortWorkspace } from "./resort-workspace.js";
import { defaultCacheDir, resilientFetchJson } from "./network-resilience.js";

export type KnownResortSummary = {
  resortKey: string;
  latestVersion: string | null;
  latestVersionNumber: number | null;
  manuallyValidated: boolean | null;
  readinessOverall: "ready" | "incomplete" | "unknown";
  readinessIssueCount: number;
  createdAt: string | null;
  layers: {
    boundary: KnownResortLayerSummary;
    runs: KnownResortLayerSummary;
    lifts: KnownResortLayerSummary;
    peaks?: KnownResortLayerSummary;
    contours?: KnownResortLayerSummary;
  };
};

export type KnownResortLayerSummary = {
  status: "pending" | "running" | "complete" | "failed" | "unknown";
  featureCount: number | null;
  checksumSha256: string | null;
  updatedAt: string | null;
};

export type OfflineBasemapMetrics = {
  generated: boolean;
  published: boolean;
  generatedPmtiles: boolean;
  generatedStyle: boolean;
  publishedPmtiles: boolean;
  publishedStyle: boolean;
  generatedPmtilesBytes: number | null;
  generatedStyleBytes: number | null;
  publishedPmtilesBytes: number | null;
  publishedStyleBytes: number | null;
};

type BasemapSourcePaths = {
  pmtilesPath: string;
  stylePath: string;
  sourceLabel: string;
};

type BasemapOfflineReadiness = {
  pmtilesReady: boolean;
  styleReady: boolean;
  offlineReady: boolean;
  issues: string[];
};

type BasemapProvider = "openmaptiles-planetiler";

type BasemapProviderConfig = {
  provider: BasemapProvider;
  bufferMeters: number;
  maxZoom: number;
  planetilerCommand: string;
};

type BasemapProviderConfigFile = {
  provider?: string;
  bufferMeters?: number;
  maxZoom?: number;
  planetilerCommand?: string;
};

export type PersistedResortVersion = {
  resortKey: string;
  resortPath: string;
  version: string;
  versionNumber: number;
  versionPath: string;
  workspacePath: string;
  statusPath: string;
  wasExistingResort: boolean;
};

export type RankedSearchCandidate = {
  candidate: ResortSearchCandidate;
  hasPolygonGeometry: boolean;
};

export type ResortLayer = "boundary" | "runs" | "lifts";

export type ClonedResortVersion = {
  version: string;
  versionNumber: number;
  versionPath: string;
  workspacePath: string;
  statusPath: string;
};

export type ValidatableLayer = "boundary" | "runs" | "lifts";

export type LayerManualValidationState = {
  validated: boolean;
  validatedAt: string | null;
  validatedBy: string | null;
  notes: string | null;
};

export type ManualValidationState = {
  validated: boolean;
  validatedAt: string | null;
  validatedBy: string | null;
  notes: string | null;
  layers: Record<ValidatableLayer, LayerManualValidationState>;
};

export type ManualValidationInput = {
  validated?: boolean;
  validatedAt?: string | null;
  validatedBy?: string | null;
  notes?: string | null;
  layers?: {
    boundary?: Partial<LayerManualValidationState>;
    runs?: Partial<LayerManualValidationState>;
    lifts?: Partial<LayerManualValidationState>;
  };
};

export type MenuReadline = {
  question: (query: string) => Promise<string>;
  close: () => void;
};

type StatusShape = {
  schemaVersion?: string;
  resortKey?: string;
  version?: string;
  createdAt?: string;
  query?: {
    name?: string;
    countryCode?: string;
    town?: string;
  };
  selection?: {
    osmType?: "relation" | "way" | "node";
    osmId?: number;
    displayName?: string;
    center?: [number, number];
  };
  layers?: {
    boundary?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
      updatedAt?: string | null;
    };
    lifts?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
      updatedAt?: string | null;
    };
    runs?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
      updatedAt?: string | null;
    };
    peaks?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
      updatedAt?: string | null;
    };
    contours?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
      updatedAt?: string | null;
    };
  };
  readiness?: {
    overall?: "ready" | "incomplete";
    issues?: string[];
  };
  manualValidation?: ManualValidationInput;
};

export async function listKnownResorts(rootPath: string): Promise<KnownResortSummary[]> {
  let rootEntries;
  try {
    rootEntries = await readdir(rootPath, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
  }

  const resorts: KnownResortSummary[] = [];
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith(".")) {
      continue;
    }

    const resortPath = join(rootPath, entry.name);
    const versions = await readVersionFolders(resortPath);
    const latestVersionNumber = versions.length > 0 ? Math.max(...versions) : null;
    const latestVersion = latestVersionNumber === null ? null : `v${String(latestVersionNumber)}`;
    const latestStatus =
      latestVersion === null ? null : await readLatestStatusSummary(join(resortPath, latestVersion, "status.json"));

    resorts.push({
      resortKey: entry.name,
      latestVersion,
      latestVersionNumber,
      manuallyValidated: latestStatus?.manuallyValidated ?? null,
      readinessOverall: latestStatus?.readinessOverall ?? "unknown",
      readinessIssueCount: latestStatus?.readinessIssueCount ?? 0,
      createdAt: latestStatus?.createdAt ?? null,
      layers: latestStatus?.layers ?? {
        boundary: unknownKnownLayerSummary(),
        runs: unknownKnownLayerSummary(),
        lifts: unknownKnownLayerSummary()
      }
    });
  }

  resorts.sort((left, right) => left.resortKey.localeCompare(right.resortKey));
  return resorts;
}

async function readVersionFolders(resortPath: string): Promise<number[]> {
  let entries;
  try {
    entries = await readdir(resortPath, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
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

async function readLatestStatusSummary(statusPath: string): Promise<{
  manuallyValidated: boolean | null;
  readinessOverall: "ready" | "incomplete" | "unknown";
  readinessIssueCount: number;
  createdAt: string | null;
  layers: {
    boundary: KnownResortLayerSummary;
    runs: KnownResortLayerSummary;
    lifts: KnownResortLayerSummary;
  };
} | null> {
  try {
    const raw = await readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as StatusShape;
    const validated = parsed.manualValidation?.validated;
    const overall = parsed.readiness?.overall;
    const issues = Array.isArray(parsed.readiness?.issues) ? parsed.readiness?.issues : [];
    return {
      manuallyValidated: typeof validated === "boolean" ? validated : null,
      readinessOverall: overall === "ready" || overall === "incomplete" ? overall : "unknown",
      readinessIssueCount: issues.length,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : null,
      layers: {
        boundary: toKnownLayerSummary(parsed.layers?.boundary),
        runs: toKnownLayerSummary(parsed.layers?.runs),
        lifts: toKnownLayerSummary(parsed.layers?.lifts)
      }
    };
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return null;
    }
    return null;
  }
}

type StatusLayerShape = NonNullable<StatusShape["layers"]>["boundary"];

function toKnownLayerSummary(layer: StatusLayerShape | undefined): KnownResortLayerSummary {
  const statusValue = (layer as { status?: unknown } | undefined)?.status;
  const status =
    statusValue === "pending" || statusValue === "running" || statusValue === "complete" || statusValue === "failed"
      ? statusValue
      : "unknown";
  const featureCountValue = (layer as { featureCount?: unknown } | undefined)?.featureCount;
  const checksumValue = (layer as { checksumSha256?: unknown } | undefined)?.checksumSha256;
  const updatedAtValue = (layer as { updatedAt?: unknown } | undefined)?.updatedAt;
  return {
    status,
    featureCount: typeof featureCountValue === "number" ? featureCountValue : null,
    checksumSha256: typeof checksumValue === "string" ? checksumValue : null,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : null
  };
}

function unknownKnownLayerSummary(): KnownResortLayerSummary {
  return {
    status: "unknown",
    featureCount: null,
    checksumSha256: null,
    updatedAt: null
  };
}

export async function runInteractiveMenu(args: {
  resortsRoot: string;
  searchFn: (query: { name: string; country: string; limit: number }) => Promise<ResortSearchResult>;
  rl?: MenuReadline;
  appPublicRoot?: string;
  rankCandidatesFn?: (candidates: ResortSearchCandidate[], options: { town: string }) => Promise<RankedSearchCandidate[]>;
}): Promise<void> {
  const rl = args.rl ?? createInterface({ input, output });
  const ownsReadline = !args.rl;
  try {
    await canonicalizeResortKeys(args.resortsRoot);

    let running = true;
    while (running) {
      console.log("");
      console.log("=== osm-extractor CLI ===");
      console.log("");
      console.log("Main menu");
      console.log("1. Resort list");
      console.log("2. New Resort");
      console.log("3. Exit");
      console.log("");

      const selected = (await rl.question("Select option (1-3): ")).trim();
      if (selected === "1") {
        const resorts = await listKnownResorts(args.resortsRoot);
        if (resorts.length === 0) {
          console.log(`No resorts found in '${args.resortsRoot}'.`);
          continue;
        }

        console.log("");
        console.log(`Known resorts (${resorts.length})`);
        console.log("");
        for (let index = 0; index < resorts.length; index += 1) {
          const resort = resorts[index];
          if (!resort) {
            continue;
          }
          console.log(formatKnownResortSummary(index + 1, resort));
          console.log("");
        }
        const resortChoice = (await rl.question(`Select resort (1-${resorts.length}, 0 to cancel): `)).trim();
        const selectedResortIndex = parseCandidateSelection(resortChoice, resorts.length);
        if (selectedResortIndex === null) {
          console.log("Selection cancelled.");
          continue;
        }
        if (selectedResortIndex === -1) {
          console.log(`Invalid selection. Please select a number between 1 and ${resorts.length}, or 0 to cancel.`);
          continue;
        }

        const selectedResort = resorts[selectedResortIndex - 1];
        if (!selectedResort || !selectedResort.latestVersion) {
          console.log("Selected resort has no version to operate on.");
          continue;
        }

        const context = getKnownResortContext(args.resortsRoot, selectedResort.resortKey, selectedResort.latestVersion);
        await runKnownResortMenu({
          rl,
          resortsRoot: args.resortsRoot,
          appPublicRoot: args.appPublicRoot ?? "./public",
          resortKey: selectedResort.resortKey,
          workspacePath: context.workspacePath,
          statusPath: context.statusPath
        });
        continue;
      }

      if (selected === "2") {
        const name = (await rl.question("Name: ")).trim();
        const countryCode = (await rl.question("Country code: ")).trim().toUpperCase();
        const town = (await rl.question("Town: ")).trim();
        if (!name || !countryCode || !town) {
          console.log("All prompts are required: Name, Country code, Town.");
          continue;
        }

        const search = await args.searchFn({
          name,
          country: countryCode,
          limit: 5
        });
        const rankedCandidates = args.rankCandidatesFn
          ? await args.rankCandidatesFn(search.candidates, { town })
          : await rankSearchCandidates(search.candidates, { town });
        console.log(`Search results (${rankedCandidates.length}):`);
        for (let index = 0; index < rankedCandidates.length; index += 1) {
          const ranked = rankedCandidates[index];
          if (!ranked) {
            continue;
          }
          console.log(formatSearchCandidate(index + 1, ranked));
        }
        if (rankedCandidates.length === 0) {
          console.log("No resort candidates found.");
          continue;
        }

        const rawIndex = (await rl.question(`Select resort (1-${rankedCandidates.length}, 0 to cancel): `)).trim();
        const selectedIndex = parseCandidateSelection(rawIndex, rankedCandidates.length);
        if (selectedIndex === null) {
          console.log("Selection cancelled.");
          continue;
        }
        if (selectedIndex === -1) {
          console.log(`Invalid selection. Please select a number between 1 and ${rankedCandidates.length}, or 0 to cancel.`);
          continue;
        }

        const picked = rankedCandidates[selectedIndex - 1]?.candidate;
        if (!picked) {
          console.log("Invalid selection. Candidate not found.");
          continue;
        }
        console.log(`Selected resort: ${picked.displayName} [${picked.osmType}/${picked.osmId}]`);

        const resortKey = buildResortKey(countryCode, town, name);
        const latestExistingVersion = await getExistingResortLatestVersion(args.resortsRoot, resortKey);
        if (latestExistingVersion) {
          console.log(`Existing resort detected: key=${resortKey} latest=${latestExistingVersion}`);
          console.log("1. Create new immutable version");
          console.log("2. Cancel");
          const duplicateChoice = (await rl.question("Select option (1-2): ")).trim();
          const duplicateAction = parseDuplicateResortAction(duplicateChoice);
          if (duplicateAction === null) {
            console.log("Invalid option. Please select 1 or 2.");
            continue;
          }
          if (duplicateAction === "cancel") {
            console.log("Creation cancelled.");
            continue;
          }
        }

        const persisted = await persistResortVersion({
          resortsRoot: args.resortsRoot,
          countryCode,
          town,
          resortName: name,
          candidate: picked
        });
        console.log(
          `Saved resort version: key=${persisted.resortKey} version=${persisted.version} path=${persisted.versionPath}`
        );
        if (persisted.wasExistingResort) {
          console.log("Existing resort detected. Created a new immutable version.");
        } else {
          console.log("Created new resort root and first immutable version.");
        }
        continue;
      }

      if (selected === "3") {
        console.log("Exiting menu.");
        running = false;
        continue;
      }

      console.log("Invalid option. Please select 1, 2, or 3.");
    }
  } finally {
    if (ownsReadline) {
      rl.close();
    }
  }
}

export function parseCandidateSelection(value: string, max: number): number | null | -1 {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return -1;
  }
  if (parsed === 0) {
    return null;
  }
  if (parsed < 1 || parsed > max) {
    return -1;
  }
  return parsed;
}

export function parseDuplicateResortAction(value: string): "create" | "cancel" | null {
  if (value === "1") {
    return "create";
  }
  if (value === "2") {
    return "cancel";
  }
  return null;
}

export function formatKnownResortSummary(index: number, resort: KnownResortSummary): string {
  const validated =
    resort.manuallyValidated === null ? "unknown" : resort.manuallyValidated ? "yes" : "no";
  const created = resort.createdAt ?? "unknown";
  const readiness =
    resort.readinessIssueCount > 0 ? `${resort.readinessOverall} (${resort.readinessIssueCount} issue(s))` : resort.readinessOverall;
  const boundary = formatKnownLayerLine("Boundary", resort.layers.boundary);
  const runs = formatKnownLayerLine("Runs", resort.layers.runs);
  const lifts = formatKnownLayerLine("Lifts", resort.layers.lifts);
  return [
    `${index}. ${resort.resortKey}`,
    `   Latest version : ${resort.latestVersion ?? "none"}`,
    `   Validated      : ${validated}`,
    `   Readiness      : ${readiness}`,
    `   Created at     : ${created}`,
    "   Layers",
    `   ${boundary}`,
    `   ${runs}`,
    `   ${lifts}`
  ].join("\n");
}

function formatKnownLayerLine(label: string, layer: KnownResortLayerSummary): string {
  const checksum = layer.checksumSha256 ? layer.checksumSha256.slice(0, 12) : "n/a";
  const updatedAt = layer.updatedAt ?? "n/a";
  const features = layer.featureCount === null ? "?" : String(layer.featureCount);
  return `- ${label.padEnd(8, " ")} status=${layer.status}  features=${features}  checksum=${checksum}  updatedAt=${updatedAt}`;
}

export function formatSearchCandidate(index: number, ranked: RankedSearchCandidate): string {
  const [lon, lat] = ranked.candidate.center;
  const region = ranked.candidate.region ?? "unknown";
  const country = ranked.candidate.countryCode?.toUpperCase() ?? ranked.candidate.country ?? "unknown";
  const importance = ranked.candidate.importance === null ? "n/a" : ranked.candidate.importance.toFixed(3);
  return `${index}. ${ranked.candidate.displayName}\n   OSM: ${ranked.candidate.osmType}/${ranked.candidate.osmId} | Country: ${country} | Region: ${region}\n   Center: ${lat.toFixed(5)},${lon.toFixed(5)} | Importance: ${importance} | BoundaryGeometry=${ranked.hasPolygonGeometry ? "yes" : "no"}`;
}

export async function rankSearchCandidates(
  candidates: ResortSearchCandidate[],
  deps?: { hasPolygonFn?: (candidate: ResortSearchCandidate) => Promise<boolean>; town?: string }
): Promise<RankedSearchCandidate[]> {
  const hasPolygonFn = deps?.hasPolygonFn ?? candidateHasPolygonGeometry;
  const townNeedle = normalizeSearchText(deps?.town ?? "");
  const ranked: RankedSearchCandidate[] = [];

  for (const candidate of candidates) {
    const hasPolygonGeometry = await hasPolygonFn(candidate).catch(() => false);
    ranked.push({
      candidate,
      hasPolygonGeometry
    });
  }

  ranked.sort((left, right) => {
    if (left.hasPolygonGeometry !== right.hasPolygonGeometry) {
      return left.hasPolygonGeometry ? -1 : 1;
    }
    const osmRank = (value: ResortSearchCandidate["osmType"]): number => {
      if (value === "relation") {
        return 0;
      }
      if (value === "way") {
        return 1;
      }
      return 2;
    };
    const leftOsmRank = osmRank(left.candidate.osmType);
    const rightOsmRank = osmRank(right.candidate.osmType);
    if (leftOsmRank !== rightOsmRank) {
      return leftOsmRank - rightOsmRank;
    }
    const leftImportance = left.candidate.importance ?? -1;
    const rightImportance = right.candidate.importance ?? -1;
    const leftTownMatch = candidateMatchesTown(left.candidate, townNeedle);
    const rightTownMatch = candidateMatchesTown(right.candidate, townNeedle);
    if (leftTownMatch !== rightTownMatch) {
      return leftTownMatch ? -1 : 1;
    }
    if (leftImportance !== rightImportance) {
      return rightImportance - leftImportance;
    }
    return left.candidate.displayName.localeCompare(right.candidate.displayName);
  });

  return ranked;
}

function candidateMatchesTown(candidate: ResortSearchCandidate, normalizedTown: string): boolean {
  if (normalizedTown.length === 0) {
    return false;
  }
  const haystack = normalizeSearchText(
    [candidate.displayName, candidate.region ?? "", candidate.country ?? ""].filter((part) => part.length > 0).join(" ")
  );
  return haystack.includes(normalizedTown);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function persistResortVersion(args: {
  resortsRoot: string;
  resortKeyOverride?: string;
  countryCode: string;
  town: string;
  resortName: string;
  candidate: ResortSearchCandidate;
  selectedAt?: string;
  createdAt?: string;
}): Promise<PersistedResortVersion> {
  const resortKey = args.resortKeyOverride ?? buildResortKey(args.countryCode, args.town, args.resortName);
  const resortPath = join(args.resortsRoot, resortKey);
  const existingVersions = await readVersionFolders(resortPath);
  const versionNumber = existingVersions.length === 0 ? 1 : Math.max(...existingVersions) + 1;
  const version = `v${String(versionNumber)}`;
  const versionPath = join(resortPath, version);
  const workspacePath = join(versionPath, "resort.json");
  const statusPath = join(versionPath, "status.json");
  const selectedAt = args.selectedAt ?? new Date().toISOString();
  const createdAt = args.createdAt ?? selectedAt;

  await mkdir(versionPath, { recursive: true });
  await writeResortWorkspace(workspacePath, {
    schemaVersion: "2.0.0",
    resort: {
      query: {
        name: args.resortName,
        country: args.countryCode
      },
      selection: {
        osmType: args.candidate.osmType,
        osmId: args.candidate.osmId,
        displayName: args.candidate.displayName,
        center: args.candidate.center,
        selectedAt
      }
    },
    layers: {
      boundary: { status: "pending" },
      lifts: { status: "pending" },
      runs: { status: "pending" }
    }
  });

  await writeStatusFile(statusPath, {
    resortKey,
    version,
    createdAt,
    query: {
      name: args.resortName,
      countryCode: args.countryCode,
      town: args.town
    },
    selection: {
      osmType: args.candidate.osmType,
      osmId: args.candidate.osmId,
      displayName: args.candidate.displayName,
      center: args.candidate.center
    }
  });

  return {
    resortKey,
    resortPath,
    version,
    versionNumber,
    versionPath,
    workspacePath,
    statusPath,
    wasExistingResort: existingVersions.length > 0
  };
}

export async function getExistingResortLatestVersion(resortsRoot: string, resortKey: string): Promise<string | null> {
  const resortPath = join(resortsRoot, resortKey);
  const versions = await readVersionFolders(resortPath);
  if (versions.length === 0) {
    return null;
  }
  return `v${String(Math.max(...versions))}`;
}

export function buildResortKey(countryCode: string, town: string, resortName: string): string {
  const cc = normalizeSegment(countryCode).toUpperCase();
  const normalizedTown = normalizeSegment(town);
  const normalizedResort = normalizeSegment(resortName);
  return `${cc}_${normalizedTown}_${normalizedResort}`;
}

function normalizeSegment(value: string): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (ascii.length === 0) {
    return "Unknown";
  }
  return ascii
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join("_");
}

async function writeStatusFile(
  path: string,
  value: {
    resortKey: string;
    version: string;
    createdAt: string;
    query: {
      name: string;
      countryCode: string;
      town: string;
    };
    selection: {
      osmType: "relation" | "way" | "node";
      osmId: number;
      displayName: string;
      center: [number, number];
    };
  }
): Promise<void> {
  const payload = {
    schemaVersion: "1.0.0",
    resortKey: value.resortKey,
    version: value.version,
    createdAt: value.createdAt,
    query: value.query,
    selection: value.selection,
    layers: {
      boundary: {
        status: "pending",
        featureCount: null,
        artifactPath: null,
        checksumSha256: null,
        updatedAt: null
      },
      lifts: {
        status: "pending",
        featureCount: null,
        artifactPath: null,
        checksumSha256: null,
        updatedAt: null
      },
      runs: {
        status: "pending",
        featureCount: null,
        artifactPath: null,
        checksumSha256: null,
        updatedAt: null
      }
    },
    readiness: {
      overall: "incomplete",
      issues: []
    },
    manualValidation: {
      validated: false,
      validatedAt: null,
      validatedBy: null,
      notes: null,
      layers: {
        boundary: {
          validated: false,
          validatedAt: null,
          validatedBy: null,
          notes: null
        },
        runs: {
          validated: false,
          validatedAt: null,
          validatedBy: null,
          notes: null
        },
        lifts: {
          validated: false,
          validatedAt: null,
          validatedBy: null,
          notes: null
        }
      }
    }
  };
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function candidateHasPolygonGeometry(candidate: ResortSearchCandidate): Promise<boolean> {
  const url = buildNominatimLookupUrl({
    osmType: candidate.osmType,
    osmId: candidate.osmId
  });
  const raw = await resilientFetchJson({
    url,
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "patrol-toolkit-osm-extractor/0.1"
    },
    throttleMs: 1100,
    cache: {
      dir: defaultCacheDir(),
      ttlMs: 60 * 60 * 1000,
      key: `menu-boundary-geometry:${candidate.osmType}:${candidate.osmId}`
    }
  }).catch(() => null);
  if (!Array.isArray(raw) || raw.length < 1) {
    return false;
  }
  const first = raw[0];
  if (!first || typeof first !== "object") {
    return false;
  }
  const geojson = (first as { geojson?: { type?: unknown } }).geojson;
  const geometryType = geojson?.type;
  return geometryType === "Polygon" || geometryType === "MultiPolygon";
}

function getKnownResortContext(resortsRoot: string, resortKey: string, version: string): {
  resortPath: string;
  versionPath: string;
  workspacePath: string;
  statusPath: string;
} {
  const resortPath = join(resortsRoot, resortKey);
  const versionPath = join(resortPath, version);
  return {
    resortPath,
    versionPath,
    workspacePath: join(versionPath, "resort.json"),
    statusPath: join(versionPath, "status.json")
  };
}

async function runKnownResortMenu(args: {
  rl: MenuReadline;
  resortsRoot: string;
  appPublicRoot: string;
  resortKey: string;
  workspacePath: string;
  statusPath: string;
}): Promise<void> {
  let workspacePath = args.workspacePath;
  let statusPath = args.statusPath;

  let keepRunning = true;
  while (keepRunning) {
    console.log("");
    console.log(`=== Resort: ${args.resortKey} ===`);
    console.log("");
    console.log("Resort menu");
    console.log("1. See metrics");
    console.log("2. Fetch/update boundary");
    console.log("3. Fetch/update runs");
    console.log("4. Fetch/update lifts");
    console.log("5. Update resort (select layers)");
    console.log("6. Validate boundary");
    console.log("7. Validate runs");
    console.log("8. Validate lifts");
    console.log("9. Generate basemap assets");
    console.log("10. Back");
    console.log("11. Re-select resort identity");
    console.log("12. Delete resort (all versions + published assets)");
    console.log("13. Unpublish resort (remove from app catalog only)");
    console.log("14. Fetch/update other things");
    const selected = (await args.rl.question("Select option (1-14): ")).trim();

    if (selected === "1") {
      const syncStatus = await readResortSyncStatus(workspacePath);
      await syncStatusFileFromWorkspace({
        workspacePath,
        statusPath
      });
      const status = await readStatusShape(statusPath);
      const manualValidation = toManualValidationState(status.manualValidation);
      const offlineBasemap = await readOfflineBasemapMetrics({
        versionPath: dirname(workspacePath),
        appPublicRoot: args.appPublicRoot,
        resortKey: args.resortKey
      });
      console.log("");
      console.log("Metrics");
      console.log(`- Sync overall: ${syncStatus.overall}`);
      console.log("- Layers");
      console.log(
        `  - Boundary: status=${syncStatus.layers.boundary.status}  features=${syncStatus.layers.boundary.featureCount ?? "?"}  ready=${syncStatus.layers.boundary.ready ? "yes" : "no"}`
      );
      console.log(
        `  - Runs    : status=${syncStatus.layers.runs.status}  features=${syncStatus.layers.runs.featureCount ?? "?"}  ready=${syncStatus.layers.runs.ready ? "yes" : "no"}`
      );
      console.log(
        `  - Lifts   : status=${syncStatus.layers.lifts.status}  features=${syncStatus.layers.lifts.featureCount ?? "?"}  ready=${syncStatus.layers.lifts.ready ? "yes" : "no"}`
      );
      const workspaceForExtras = await readResortWorkspace(workspacePath);
      if (workspaceForExtras.layers.peaks) {
        console.log(
          `  - Peaks   : status=${workspaceForExtras.layers.peaks.status}  features=${workspaceForExtras.layers.peaks.featureCount ?? "?"}`
        );
      }
      if (workspaceForExtras.layers.contours) {
        console.log(
          `  - Contours: status=${workspaceForExtras.layers.contours.status}  features=${workspaceForExtras.layers.contours.featureCount ?? "?"}`
        );
      }
      console.log("- Validation");
      console.log(`  - Boundary: ${formatLayerValidationSummary(manualValidation.layers.boundary)}`);
      console.log(`  - Runs    : ${formatLayerValidationSummary(manualValidation.layers.runs)}`);
      console.log(`  - Lifts   : ${formatLayerValidationSummary(manualValidation.layers.lifts)}`);
      console.log(`  - Overall : ${manualValidation.validated ? "yes" : "no"}`);
      console.log("- Offline basemap");
      console.log(
        `  - Generated: ${offlineBasemap.generated ? "yes" : "no"} (pmtiles=${offlineBasemap.generatedPmtiles ? "yes" : "no"} ${formatBytes(offlineBasemap.generatedPmtilesBytes)}, style=${offlineBasemap.generatedStyle ? "yes" : "no"} ${formatBytes(offlineBasemap.generatedStyleBytes)})`
      );
      console.log(
        `  - Published: ${offlineBasemap.published ? "yes" : "no"} (pmtiles=${offlineBasemap.publishedPmtiles ? "yes" : "no"} ${formatBytes(offlineBasemap.publishedPmtilesBytes)}, style=${offlineBasemap.publishedStyle ? "yes" : "no"} ${formatBytes(offlineBasemap.publishedStyleBytes)})`
      );
      continue;
    }

    if (selected === "2") {
      let cloned: ClonedResortVersion | null = null;
      try {
        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });

        const result = await runBoundaryUpdateForWorkspace({
          rl: args.rl,
          workspacePath: cloned.workspacePath
        });
        if (result === null) {
          await rm(cloned.versionPath, { recursive: true, force: true });
          console.log("Boundary update cancelled.");
          continue;
        }
        await syncStatusFileFromWorkspace({
          workspacePath: cloned.workspacePath,
          statusPath: cloned.statusPath
        });
        workspacePath = cloned.workspacePath;
        statusPath = cloned.statusPath;
        console.log(`Created version ${cloned.version} for boundary update.`);
        console.log(`Boundary updated: ${result.selectedOsm.displayName} checksum=${result.checksumSha256}`);
      } catch (error: unknown) {
        if (cloned) {
          await rm(cloned.versionPath, { recursive: true, force: true });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Boundary update failed: ${message}`);
      }
      continue;
    }

    if (selected === "3") {
      const workspace = await readResortWorkspace(workspacePath);
      if (!isBoundaryReadyForSync(workspace)) {
        console.log("Cannot sync runs yet. Boundary is not ready. Run 'Fetch/update boundary' first.");
        continue;
      }
      let cloned: ClonedResortVersion | null = null;
      try {
        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });
        const result = await syncResortRuns({
          workspacePath: cloned.workspacePath,
          bufferMeters: 50
        });
        await syncStatusFileFromWorkspace({
          workspacePath: cloned.workspacePath,
          statusPath: cloned.statusPath
        });
        workspacePath = cloned.workspacePath;
        statusPath = cloned.statusPath;
        console.log(`Created version ${cloned.version} for runs update.`);
        console.log(`Runs updated: count=${result.runCount} checksum=${result.checksumSha256}`);
      } catch (error: unknown) {
        if (cloned) {
          await rm(cloned.versionPath, { recursive: true, force: true });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Runs update failed: ${message}`);
      }
      continue;
    }

    if (selected === "4") {
      const workspace = await readResortWorkspace(workspacePath);
      if (!isBoundaryReadyForSync(workspace)) {
        console.log("Cannot sync lifts yet. Boundary is not ready. Run 'Fetch/update boundary' first.");
        continue;
      }
      let cloned: ClonedResortVersion | null = null;
      try {
        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });
        const result = await syncResortLifts({
          workspacePath: cloned.workspacePath,
          bufferMeters: 50
        });
        await syncStatusFileFromWorkspace({
          workspacePath: cloned.workspacePath,
          statusPath: cloned.statusPath
        });
        workspacePath = cloned.workspacePath;
        statusPath = cloned.statusPath;
        console.log(`Created version ${cloned.version} for lifts update.`);
        console.log(`Lifts updated: count=${result.liftCount} checksum=${result.checksumSha256}`);
      } catch (error: unknown) {
        if (cloned) {
          await rm(cloned.versionPath, { recursive: true, force: true });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Lifts update failed: ${message}`);
      }
      continue;
    }

    if (selected === "5") {
      const selectionRaw = (
        await args.rl.question("Select layers to update (boundary,runs,lifts | b,r,l | all | 0 cancel): ")
      ).trim();
      if (selectionRaw === "0") {
        console.log("Update cancelled.");
        continue;
      }
      const layers = parseLayerSelection(selectionRaw);
      if (layers === null || layers.length === 0) {
        console.log("Invalid layer selection. Use boundary,runs,lifts or all.");
        continue;
      }

      const currentWorkspace = await readResortWorkspace(workspacePath);
      if ((layers.includes("runs") || layers.includes("lifts")) && !layers.includes("boundary")) {
        if (!isBoundaryReadyForSync(currentWorkspace)) {
          console.log("Cannot sync runs/lifts without a ready boundary. Include boundary or update boundary first.");
          continue;
        }
      }

      let cloned: ClonedResortVersion | null = null;
      try {
        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });

        const stepLogs: string[] = [];
        for (const layer of layers) {
          if (layer === "boundary") {
            const boundary = await runBoundaryUpdateForWorkspace({
              rl: args.rl,
              workspacePath: cloned.workspacePath
            });
            if (boundary === null) {
              throw new Error("Boundary update cancelled by user.");
            }
            stepLogs.push(`boundary: ${boundary.selectedOsm.displayName}`);
            continue;
          }
          if (layer === "runs") {
            const runs = await syncResortRuns({
              workspacePath: cloned.workspacePath,
              bufferMeters: 50
            });
            stepLogs.push(`runs: count=${runs.runCount}`);
            continue;
          }
          const lifts = await syncResortLifts({
            workspacePath: cloned.workspacePath,
            bufferMeters: 50
          });
          stepLogs.push(`lifts: count=${lifts.liftCount}`);
        }

        await syncStatusFileFromWorkspace({
          workspacePath: cloned.workspacePath,
          statusPath: cloned.statusPath
        });
        workspacePath = cloned.workspacePath;
        statusPath = cloned.statusPath;
        console.log(`Created version ${cloned.version} for resort update.`);
        for (const step of stepLogs) {
          console.log(`Updated ${step}`);
        }
      } catch (error: unknown) {
        if (cloned) {
          await rm(cloned.versionPath, { recursive: true, force: true });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Resort update failed: ${message}`);
      }
      continue;
    }

    if (selected === "6" || selected === "7" || selected === "8") {
      const layer: ValidatableLayer = selected === "6" ? "boundary" : selected === "7" ? "runs" : "lifts";
      const workspace = await readResortWorkspace(workspacePath);
      if (workspace.layers[layer].status !== "complete") {
        console.log(`Cannot validate ${layer}. Layer is not complete yet.`);
        continue;
      }
      const existingStatus = await readStatusShape(statusPath);
      const existingManualValidation = toManualValidationState(existingStatus.manualValidation);
      console.log(`Current ${layer} validation: ${formatLayerValidationSummary(existingManualValidation.layers[layer])}`);
      const validatedAnswer = (await args.rl.question(`Mark ${layer} as validated? (y/N): `)).trim().toLowerCase();
      const validated = validatedAnswer === "y" || validatedAnswer === "yes";
      let validatedBy: string | null = null;
      let notes: string | null = null;
      if (validated) {
        const validatedByRaw = (await args.rl.question("Validated by (optional): ")).trim();
        const notesRaw = (await args.rl.question("Validation notes (optional): ")).trim();
        validatedBy = validatedByRaw.length > 0 ? validatedByRaw : null;
        notes = notesRaw.length > 0 ? notesRaw : null;
      }

      const nextManualValidation = setLayerManualValidation({
        current: existingStatus.manualValidation,
        layer,
        validated,
        validatedAt: validated ? new Date().toISOString() : null,
        validatedBy,
        notes
      });
      const payload: StatusShape = {
        ...existingStatus,
        manualValidation: nextManualValidation
      };
      await writeFile(statusPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      console.log(`Updated ${layer} validation: ${formatLayerValidationSummary(nextManualValidation.layers[layer])}`);
      if (nextManualValidation.validated) {
        try {
          const published = await publishCurrentValidatedVersionToAppCatalog({
            resortKey: args.resortKey,
            workspacePath,
            statusPath,
            appPublicRoot: args.appPublicRoot
          });
          console.log(
            `Auto-published resort to app catalog: version=${published.version} pack=${published.outputPath}`
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Auto-publish failed: ${message}`);
        }
      }
      continue;
    }

    if (selected === "9") {
      const workspace = await readResortWorkspace(workspacePath);
      if (!isBoundaryReadyForSync(workspace)) {
        console.log("Cannot generate basemap assets yet. Boundary is not ready. Run 'Fetch/update boundary' first.");
        continue;
      }

      console.log("Basemap generation");
      console.log("1. Generate/publish");
      console.log("2. Dry-run preview (no writes)");
      console.log("3. Force rebuild (provider rebuild + publish)");
      const modeSelectedRaw = (await args.rl.question("Select basemap mode (1-3): ")).trim();
      const modeSelected = modeSelectedRaw.length === 0 ? "1" : modeSelectedRaw;
      if (!["1", "2", "3"].includes(modeSelected)) {
        console.log("Invalid basemap mode. Select 1, 2, or 3.");
        continue;
      }

      if (modeSelected === "2") {
        try {
          const preview = await previewBasemapGeneration({
            workspace,
            versionPath: dirname(workspacePath),
            resortsRoot: args.resortsRoot,
            resortKey: args.resortKey,
            appPublicRoot: args.appPublicRoot
          });
          console.log("");
          console.log("Basemap dry-run preview");
          console.log(`- Target: ${preview.targetVersionBasemapDir}`);
          console.log(
            `- Current version basemap: ${preview.currentVersionOfflineReady ? "offline-ready" : "not offline-ready"}`
          );
          if (preview.currentVersionIssues.length > 0) {
            console.log(`- Current issues: ${preview.currentVersionIssues.join("; ")}`);
          }
          console.log(`- Candidate source: ${preview.sourceLabel ?? "none"}`);
          if (preview.providerSummary) {
            console.log(
              `- Provider: ${preview.providerSummary.provider} (buffer=${preview.providerSummary.bufferMeters}m, maxZoom=${preview.providerSummary.maxZoom})`
            );
            console.log(`- Buffered bbox: ${preview.providerSummary.bboxCsv}`);
            console.log(`- Command preview: ${preview.providerSummary.commandPreview}`);
          } else {
            console.log("- Provider preview unavailable: config and/or boundary artifacts missing.");
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Basemap dry-run failed: ${message}`);
        }
        continue;
      }

      const forceRebuild = modeSelected === "3";
      if (forceRebuild) {
        const confirmed = (await args.rl.question("Force rebuild will overwrite current version basemap. Continue? (y/N): "))
          .trim()
          .toLowerCase();
        if (confirmed !== "y" && confirmed !== "yes") {
          console.log("Force rebuild cancelled.");
          continue;
        }
      }

      try {
        if (forceRebuild) {
          console.log("Force rebuild selected. Rebuilding shared basemap via provider...");
          await buildSharedBasemapFromProvider({
            workspace,
            versionPath: dirname(workspacePath),
            resortsRoot: args.resortsRoot,
            resortKey: args.resortKey
          });
          console.log("Provider basemap build complete.");
        }

        const result = await generateBasemapAssetsForVersion({
          resortsRoot: args.resortsRoot,
          appPublicRoot: args.appPublicRoot,
          resortKey: args.resortKey,
          versionPath: dirname(workspacePath),
          forceRebuild
        }).catch(async (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (forceRebuild || !/No offline-ready basemap source found/iu.test(message)) {
            throw error;
          }

          console.log(message);
          console.log("Attempting local basemap build via provider...");
          await buildSharedBasemapFromProvider({
            workspace,
            versionPath: dirname(workspacePath),
            resortsRoot: args.resortsRoot,
            resortKey: args.resortKey
          });
          console.log("Provider basemap build complete.");

          return generateBasemapAssetsForVersion({
            resortsRoot: args.resortsRoot,
            appPublicRoot: args.appPublicRoot,
            resortKey: args.resortKey,
            versionPath: dirname(workspacePath)
          });
        });
        if (result.generatedNow) {
          console.log(`Basemap assets generated under ${join(dirname(workspacePath), "basemap")} from ${result.sourceLabel}.`);
        } else {
          console.log(`Basemap assets already present under ${join(dirname(workspacePath), "basemap")}.`);
        }
        await assertBasemapArtifactsExist({
          label: "Generated basemap artifacts",
          files: [
            join(dirname(workspacePath), "basemap", "base.pmtiles"),
            join(dirname(workspacePath), "basemap", "style.json")
          ]
        });
        console.log("Generated artifact check passed: base.pmtiles, style.json.");

        const currentStatus = await readStatusShape(statusPath);
        const manualValidation = toManualValidationState(currentStatus.manualValidation);
        if (!manualValidation.validated) {
          console.log("Publish pending: version is not fully validated yet.");
          continue;
        }

        try {
          const published = await publishCurrentValidatedVersionToAppCatalog({
            resortKey: args.resortKey,
            workspacePath,
            statusPath,
            appPublicRoot: args.appPublicRoot
          });
          await assertBasemapArtifactsExist({
            label: "Published basemap artifacts",
            files: [
              join(args.appPublicRoot, "packs", args.resortKey, "base.pmtiles"),
              join(args.appPublicRoot, "packs", args.resortKey, "style.json")
            ]
          });
          console.log(`Published resort assets: version=${published.version} pack=${published.outputPath}`);
          console.log("Published artifact check passed: base.pmtiles, style.json.");
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Auto-publish after basemap generation failed: ${message}`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Basemap generation failed: ${message}`);
      }
      continue;
    }

    if (selected === "11") {
      const existingStatus = await readStatusShape(statusPath);
      const defaultName = existingStatus.query?.name ?? "";
      const defaultCountryCode = existingStatus.query?.countryCode ?? "";
      const defaultTown = existingStatus.query?.town ?? "";

      const nameRaw = (await args.rl.question(`Name${defaultName ? ` [${defaultName}]` : ""}: `)).trim();
      const countryRaw = (await args.rl.question(`Country code${defaultCountryCode ? ` [${defaultCountryCode}]` : ""}: `))
        .trim()
        .toUpperCase();
      const townRaw = (await args.rl.question(`Town${defaultTown ? ` [${defaultTown}]` : ""}: `)).trim();

      const name = nameRaw || defaultName;
      const countryCode = countryRaw || defaultCountryCode;
      const town = townRaw || defaultTown;
      if (!name || !countryCode || !town) {
        console.log("All prompts are required: Name, Country code, Town.");
        continue;
      }

      const search = await searchResortCandidates({
        name,
        country: countryCode,
        limit: 5
      });
      const rankedCandidates = await rankSearchCandidates(search.candidates, { town });
      if (rankedCandidates.length === 0) {
        console.log("No resort candidates found.");
        continue;
      }

      console.log(`Search results (${rankedCandidates.length}):`);
      for (let index = 0; index < rankedCandidates.length; index += 1) {
        const ranked = rankedCandidates[index];
        if (!ranked) {
          continue;
        }
        console.log(formatSearchCandidate(index + 1, ranked));
      }

      const rawIndex = (await args.rl.question(`Select resort (1-${rankedCandidates.length}, 0 to cancel): `)).trim();
      const selectedIndex = parseCandidateSelection(rawIndex, rankedCandidates.length);
      if (selectedIndex === null) {
        console.log("Selection cancelled.");
        continue;
      }
      if (selectedIndex === -1) {
        console.log(`Invalid selection. Please select a number between 1 and ${rankedCandidates.length}, or 0 to cancel.`);
        continue;
      }
      const picked = rankedCandidates[selectedIndex - 1]?.candidate;
      if (!picked) {
        console.log("Invalid selection. Candidate not found.");
        continue;
      }

      const persisted = await persistResortVersion({
        resortsRoot: args.resortsRoot,
        resortKeyOverride: args.resortKey,
        countryCode,
        town,
        resortName: name,
        candidate: picked
      });
      workspacePath = persisted.workspacePath;
      statusPath = persisted.statusPath;
      console.log(
        `Resort identity updated: key=${persisted.resortKey} version=${persisted.version} path=${persisted.versionPath}`
      );
      continue;
    }

    if (selected === "10") {
      keepRunning = false;
      continue;
    }

    if (selected === "12") {
      const confirmation = (
        await args.rl.question(`Type DELETE ${args.resortKey} to confirm permanent deletion: `)
      ).trim();
      if (confirmation !== `DELETE ${args.resortKey}`) {
        console.log("Deletion cancelled.");
        continue;
      }

      const resortPath = dirname(dirname(workspacePath));
      try {
        await deleteResortAndPublishedArtifacts({
          resortKey: args.resortKey,
          resortPath,
          appPublicRoot: args.appPublicRoot
        });
        console.log(`Deleted resort ${args.resortKey} and all related artifacts.`);
        keepRunning = false;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Delete resort failed: ${message}`);
      }
      continue;
    }

    if (selected === "13") {
      const confirmation = (
        await args.rl.question(`Type UNPUBLISH ${args.resortKey} to remove published app assets: `)
      ).trim();
      if (confirmation !== `UNPUBLISH ${args.resortKey}`) {
        console.log("Unpublish cancelled.");
        continue;
      }

      try {
        await unpublishResortArtifacts({
          resortKey: args.resortKey,
          appPublicRoot: args.appPublicRoot
        });
        console.log(`Unpublished resort ${args.resortKey} from app catalog and public packs.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Unpublish resort failed: ${message}`);
      }
      continue;
    }

    if (selected === "14") {
      console.log("");
      console.log("Fetch/update other things");
      console.log("1. Peaks");
      console.log("2. Contours");
      console.log("3. Back");
      const extraSelected = (await args.rl.question("Select option (1-3): ")).trim();
      if (extraSelected === "3" || extraSelected === "0") {
        continue;
      }
      if (extraSelected !== "1" && extraSelected !== "2") {
        console.log("Invalid selection.");
        continue;
      }

      const workspace = await readResortWorkspace(workspacePath);
      if (!isBoundaryReadyForSync(workspace)) {
        console.log("Cannot sync peaks yet. Boundary is not ready. Run 'Fetch/update boundary' first.");
        continue;
      }
      let cloned: ClonedResortVersion | null = null;
      if (extraSelected === "1") {
        const peaksBufferInput = (
          await args.rl.question("Peaks buffer meters (default 5000): ")
        ).trim();
        const peaksBufferMeters =
          peaksBufferInput.length === 0 ? 5000 : Number.parseInt(peaksBufferInput, 10);
        if (!Number.isFinite(peaksBufferMeters) || peaksBufferMeters < 0) {
          console.log("Invalid buffer. Enter a non-negative integer number of meters.");
          continue;
        }
        try {
          cloned = await createNextVersionClone({
            resortsRoot: args.resortsRoot,
            resortKey: args.resortKey,
            workspacePath,
            statusPath
          });
          const result = await syncResortPeaks({
            workspacePath: cloned.workspacePath,
            bufferMeters: peaksBufferMeters
          });
          await syncStatusFileFromWorkspace({
            workspacePath: cloned.workspacePath,
            statusPath: cloned.statusPath
          });
          workspacePath = cloned.workspacePath;
          statusPath = cloned.statusPath;
          console.log(`Created version ${cloned.version} for peaks update.`);
          console.log(
            `Peaks updated: count=${result.peakCount} buffer=${peaksBufferMeters}m checksum=${result.checksumSha256}`
          );
        } catch (error: unknown) {
          if (cloned) {
            await rm(cloned.versionPath, { recursive: true, force: true });
          }
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Peaks update failed: ${message}`);
        }
        continue;
      }

      const contourBufferInput = (
        await args.rl.question("Contours buffer meters (default 2000): ")
      ).trim();
      const contourBufferMeters =
        contourBufferInput.length === 0 ? 2000 : Number.parseInt(contourBufferInput, 10);
      if (!Number.isFinite(contourBufferMeters) || contourBufferMeters < 0) {
        console.log("Invalid buffer. Enter a non-negative integer number of meters.");
        continue;
      }
      const contourIntervalInput = (
        await args.rl.question("Contour interval meters (default 20): ")
      ).trim();
      const contourIntervalMeters =
        contourIntervalInput.length === 0 ? 20 : Number.parseInt(contourIntervalInput, 10);
      if (!Number.isFinite(contourIntervalMeters) || contourIntervalMeters <= 0) {
        console.log("Invalid contour interval. Enter an integer number of meters > 0.");
        continue;
      }
      try {
        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });
        const result = await syncResortContours({
          workspacePath: cloned.workspacePath,
          bufferMeters: contourBufferMeters,
          contourIntervalMeters
        });
        await syncStatusFileFromWorkspace({
          workspacePath: cloned.workspacePath,
          statusPath: cloned.statusPath
        });
        workspacePath = cloned.workspacePath;
        statusPath = cloned.statusPath;
        console.log(`Created version ${cloned.version} for contours update.`);
        console.log(
          `Contours updated: count=${result.importedFeatureCount} interval=${contourIntervalMeters}m buffer=${contourBufferMeters}m checksum=${result.checksumSha256}`
        );
      } catch (error: unknown) {
        if (cloned) {
          await rm(cloned.versionPath, { recursive: true, force: true });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Contours update failed: ${message}`);
      }
      continue;
    }

    console.log("Invalid option. Please select 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, or 14.");
  }
}

export async function attachBasemapAssetsToVersion(args: {
  versionPath: string;
  pmtilesSourcePath: string;
  styleSourcePath: string;
}): Promise<void> {
  await assertRegularFile(args.pmtilesSourcePath, "Missing basemap PMTiles");
  await assertRegularFile(args.styleSourcePath, "Missing basemap style");
  await assertOfflineReadyBasemapAssets({
    pmtilesPath: args.pmtilesSourcePath,
    stylePath: args.styleSourcePath,
    label: "Basemap source is not offline-ready"
  });

  const basemapDir = join(args.versionPath, "basemap");
  await mkdir(basemapDir, { recursive: true });
  await cp(args.pmtilesSourcePath, join(basemapDir, "base.pmtiles"));
  await cp(args.styleSourcePath, join(basemapDir, "style.json"));
}

export async function generateBasemapAssetsForVersion(args: {
  resortsRoot: string;
  appPublicRoot: string;
  resortKey: string;
  versionPath: string;
  forceRebuild?: boolean;
}): Promise<{ generatedNow: boolean; sourceLabel: string }> {
  const targetPmtiles = join(args.versionPath, "basemap", "base.pmtiles");
  const targetStyle = join(args.versionPath, "basemap", "style.json");
  const forceRebuild = args.forceRebuild === true;
  const currentReadiness = await inspectOfflineBasemapReadiness({
    pmtilesPath: targetPmtiles,
    stylePath: targetStyle
  });
  if (currentReadiness.offlineReady && !forceRebuild) {
    return { generatedNow: false, sourceLabel: "current version basemap" };
  }

  const sourcePaths = await resolveBasemapSourcePaths(args);
  if (!sourcePaths) {
    const sharedBasemapDir = join(args.resortsRoot, args.resortKey, "basemap");
    const details = currentReadiness.issues.length > 0 ? ` Existing version basemap issues: ${currentReadiness.issues.join("; ")}.` : "";
    throw new Error(
      `No offline-ready basemap source found.${details} Place base.pmtiles and style.json under ${sharedBasemapDir} and run Generate basemap assets again.`
    );
  }

  await attachBasemapAssetsToVersion({
    versionPath: args.versionPath,
    pmtilesSourcePath: sourcePaths.pmtilesPath,
    styleSourcePath: sourcePaths.stylePath
  });
  return {
    generatedNow: true,
    sourceLabel: sourcePaths.sourceLabel
  };
}

type BasemapDryRunPreview = {
  mode: "dry-run";
  forceRebuild: boolean;
  targetVersionBasemapDir: string;
  currentVersionOfflineReady: boolean;
  currentVersionIssues: string[];
  sourceLabel: string | null;
  providerSummary: {
    provider: string;
    bufferMeters: number;
    maxZoom: number;
    bboxCsv: string;
    commandPreview: string;
  } | null;
};

export async function previewBasemapGeneration(args: {
  workspace: ResortWorkspace;
  versionPath: string;
  resortsRoot: string;
  resortKey: string;
  appPublicRoot: string;
  forceRebuild?: boolean;
}): Promise<BasemapDryRunPreview> {
  const targetPmtiles = join(args.versionPath, "basemap", "base.pmtiles");
  const targetStyle = join(args.versionPath, "basemap", "style.json");
  const readiness = await inspectOfflineBasemapReadiness({
    pmtilesPath: targetPmtiles,
    stylePath: targetStyle
  });
  const source = await resolveBasemapSourcePaths({
    resortsRoot: args.resortsRoot,
    appPublicRoot: args.appPublicRoot,
    resortKey: args.resortKey,
    versionPath: args.versionPath
  });

  let providerSummary: BasemapDryRunPreview["providerSummary"] = null;
  try {
    const provider = await readBasemapProviderConfig();
    const boundaryArtifactPath = await resolveBoundaryArtifactPath(args.workspace, args.versionPath);
    const boundaryRing = await readBoundaryRingFromArtifact(boundaryArtifactPath);
    const bbox = computeBufferedBbox(boundaryRing, provider.bufferMeters);
    const planetilerDataDir = resolve(args.resortsRoot, ".cache", "planetiler");
    const commandPreview = ensurePlanetilerRuntimeDefaults(
      renderBasemapProviderCommand(provider.planetilerCommand, {
        resortKey: args.resortKey,
        minLon: bbox.minLon,
        minLat: bbox.minLat,
        maxLon: bbox.maxLon,
        maxLat: bbox.maxLat,
        bboxCsv: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
        bufferMeters: provider.bufferMeters,
        maxZoom: provider.maxZoom,
        outputPmtiles: targetPmtiles,
        outputStyle: targetStyle,
        boundaryGeojson: "<boundary.geojson>",
        osmExtractPath: "<auto-geofabrik-extract>",
        planetilerJarPath: "<auto-planetiler-jar>",
        planetilerDataDir
      }),
      {
        downloadDir: join(planetilerDataDir, "sources"),
        tempDir: join(planetilerDataDir, "tmp")
      }
    );
    providerSummary = {
      provider: provider.provider,
      bufferMeters: provider.bufferMeters,
      maxZoom: provider.maxZoom,
      bboxCsv: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
      commandPreview
    };
  } catch {
    providerSummary = null;
  }

  return {
    mode: "dry-run",
    forceRebuild: args.forceRebuild === true,
    targetVersionBasemapDir: join(args.versionPath, "basemap"),
    currentVersionOfflineReady: readiness.offlineReady,
    currentVersionIssues: readiness.issues,
    sourceLabel: source?.sourceLabel ?? null,
    providerSummary
  };
}

async function resolveBasemapSourcePaths(args: {
  resortsRoot: string;
  appPublicRoot: string;
  resortKey: string;
  versionPath: string;
}): Promise<BasemapSourcePaths | null> {
  const resortBasemap = {
    pmtilesPath: join(args.resortsRoot, args.resortKey, "basemap", "base.pmtiles"),
    stylePath: join(args.resortsRoot, args.resortKey, "basemap", "style.json"),
    sourceLabel: "resort shared basemap"
  };
  if (await isOfflineReadyBasemapAssets(resortBasemap.pmtilesPath, resortBasemap.stylePath)) {
    return resortBasemap;
  }

  const versionBasemap = await resolveBasemapFromOtherVersion(args);
  if (versionBasemap) {
    return versionBasemap;
  }

  const publishedBasemap = {
    pmtilesPath: join(args.appPublicRoot, "packs", args.resortKey, "base.pmtiles"),
    stylePath: join(args.appPublicRoot, "packs", args.resortKey, "style.json"),
    sourceLabel: "published app basemap"
  };
  if (await isOfflineReadyBasemapAssets(publishedBasemap.pmtilesPath, publishedBasemap.stylePath)) {
    return publishedBasemap;
  }

  return null;
}

async function resolveBasemapFromOtherVersion(args: {
  resortsRoot: string;
  resortKey: string;
  versionPath: string;
}): Promise<BasemapSourcePaths | null> {
  const resortPath = join(args.resortsRoot, args.resortKey);
  const currentVersionDirName = basename(args.versionPath);
  let entries;
  try {
    entries = await readdir(resortPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const versionNames = entries
    .filter((entry) => entry.isDirectory() && /^v\d+$/iu.test(entry.name) && entry.name !== currentVersionDirName)
    .map((entry) => entry.name)
    .sort((left, right) => (parseVersionFolder(right) ?? -1) - (parseVersionFolder(left) ?? -1));

  for (const versionName of versionNames) {
    const candidate = {
      pmtilesPath: join(resortPath, versionName, "basemap", "base.pmtiles"),
      stylePath: join(resortPath, versionName, "basemap", "style.json"),
      sourceLabel: `existing version ${versionName}`
    };
    if (await isOfflineReadyBasemapAssets(candidate.pmtilesPath, candidate.stylePath)) {
      return candidate;
    }
  }

  return null;
}

export function parseLayerSelection(value: string): ResortLayer[] | null {
  const raw = value.trim().toLowerCase();
  if (raw.length === 0) {
    return null;
  }
  if (raw === "all" || raw === "a") {
    return ["boundary", "runs", "lifts"];
  }

  const tokens = raw.split(/[,\s]+/).filter((part) => part.length > 0);
  if (tokens.length === 0) {
    return null;
  }

  const selected = new Set<ResortLayer>();
  for (const token of tokens) {
    if (token === "boundary" || token === "b") {
      selected.add("boundary");
      continue;
    }
    if (token === "runs" || token === "r") {
      selected.add("runs");
      continue;
    }
    if (token === "lifts" || token === "l") {
      selected.add("lifts");
      continue;
    }
    return null;
  }

  const ordered: ResortLayer[] = [];
  if (selected.has("boundary")) {
    ordered.push("boundary");
  }
  if (selected.has("runs")) {
    ordered.push("runs");
  }
  if (selected.has("lifts")) {
    ordered.push("lifts");
  }
  return ordered;
}

async function runBoundaryUpdateForWorkspace(args: {
  rl: MenuReadline;
  workspacePath: string;
}): Promise<Awaited<ReturnType<typeof setResortBoundary>> | null> {
  let detection = await detectResortBoundaryCandidates({
    workspacePath: args.workspacePath,
    searchLimit: 5
  });
  let polygonCandidates = detection.candidates.filter((candidate) => candidate.ring !== null);
  if (polygonCandidates.length === 0) {
    const hint = (
      await args.rl.question("No boundary found. Optional location hint (e.g. Kananaskis, Alberta), or Enter to cancel: ")
    ).trim();
    if (hint.length === 0) {
      throw new Error("No valid boundary candidates with polygon geometry were found.");
    }
    detection = await detectResortBoundaryCandidates({
      workspacePath: args.workspacePath,
      searchLimit: 5,
      locationHint: hint
    });
    polygonCandidates = detection.candidates.filter((candidate) => candidate.ring !== null);
    if (polygonCandidates.length === 0) {
      throw new Error("No valid boundary candidates with polygon geometry were found.");
    }
  }

  console.log(`Boundary candidates (${polygonCandidates.length}):`);
  for (let index = 0; index < polygonCandidates.length; index += 1) {
    const candidate = polygonCandidates[index];
    if (!candidate) {
      continue;
    }
    console.log(
      `${index + 1}. ${candidate.displayName} [${candidate.osmType}/${candidate.osmId}] score=${candidate.validation.score} containsCenter=${candidate.validation.containsSelectionCenter ? "yes" : "no"} dist=${candidate.validation.distanceToSelectionCenterKm.toFixed(1)}km why=${candidate.validation.signals.slice(0, 3).join(",") || "none"}`
    );
  }

  const rawIndex = (await args.rl.question(`Select boundary (1-${polygonCandidates.length}, 0 to cancel): `)).trim();
  const selectedIndex = parseCandidateSelection(rawIndex, polygonCandidates.length);
  if (selectedIndex === null) {
    return null;
  }
  if (selectedIndex === -1) {
    throw new Error("Invalid boundary selection.");
  }

  const picked = polygonCandidates[selectedIndex - 1];
  if (!picked) {
    throw new Error("Invalid boundary selection.");
  }

  if (!picked.validation.containsSelectionCenter) {
    const confirm = (await args.rl.question("Warning: boundary does not contain selected resort center. Continue? (y/N): "))
      .trim()
      .toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      return null;
    }
  }

  const pickedIndexInDetection = detection.candidates.findIndex(
    (candidate) => candidate.osmType === picked.osmType && candidate.osmId === picked.osmId
  );
  if (pickedIndexInDetection < 0) {
    throw new Error("Boundary candidate mapping failed.");
  }

  return setResortBoundary({
    workspacePath: args.workspacePath,
    index: pickedIndexInDetection + 1
  });
}

async function syncStatusFileFromWorkspace(args: { workspacePath: string; statusPath: string }): Promise<void> {
  const workspace = await readResortWorkspace(args.workspacePath);
  const sync = await readResortSyncStatus(args.workspacePath);
  const existing = await readStatusShape(args.statusPath);

  const payload: StatusShape = {
    schemaVersion: existing.schemaVersion ?? "1.0.0",
    resortKey: existing.resortKey,
    version: existing.version,
    createdAt: existing.createdAt,
    query: existing.query ?? {},
    selection: existing.selection ?? {},
    layers: {
      boundary: toStatusLayer(workspace.layers.boundary),
      runs: toStatusLayer(workspace.layers.runs),
      lifts: toStatusLayer(workspace.layers.lifts),
      ...(workspace.layers.peaks ? { peaks: toStatusLayer(workspace.layers.peaks) } : {}),
      ...(workspace.layers.contours ? { contours: toStatusLayer(workspace.layers.contours) } : {})
    },
    readiness: {
      overall: sync.overall,
      issues: sync.issues
    },
    manualValidation: toManualValidationState(existing.manualValidation)
  };

  await writeFile(args.statusPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function toStatusLayer(layer: ResortWorkspace["layers"]["boundary"]): {
  status: "pending" | "running" | "complete" | "failed";
  featureCount: number | null;
  artifactPath: string | null;
  checksumSha256: string | null;
  updatedAt: string | null;
} {
  return {
    status: layer.status,
    featureCount: layer.featureCount ?? null,
    artifactPath: layer.artifactPath ?? null,
    checksumSha256: layer.checksumSha256 ?? null,
    updatedAt: layer.updatedAt ?? null
  };
}

async function readStatusShape(path: string): Promise<StatusShape> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as StatusShape;
    return parsed;
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return {};
    }
    return {};
  }
}

export async function createNextVersionClone(args: {
  resortsRoot: string;
  resortKey: string;
  workspacePath: string;
  statusPath: string;
  createdAt?: string;
}): Promise<ClonedResortVersion> {
  const resortPath = join(args.resortsRoot, args.resortKey);
  const versions = await readVersionFolders(resortPath);
  const versionNumber = versions.length === 0 ? 1 : Math.max(...versions) + 1;
  const version = `v${String(versionNumber)}`;
  const versionPath = join(resortPath, version);
  const sourceVersionPath = dirname(args.workspacePath);
  const workspacePath = join(versionPath, "resort.json");
  const statusPath = join(versionPath, "status.json");

  await cp(sourceVersionPath, versionPath, { recursive: true, force: false, errorOnExist: true });

  const existingStatus = await readStatusShape(statusPath);
  const createdAt = args.createdAt ?? new Date().toISOString();
  const updatedStatus: StatusShape = {
    ...existingStatus,
    version,
    createdAt,
    manualValidation: toManualValidationState(undefined)
  };
  await writeFile(statusPath, `${JSON.stringify(updatedStatus, null, 2)}\n`, "utf8");

  const workspace = await readResortWorkspace(workspacePath);
  await writeResortWorkspace(workspacePath, workspace);

  return {
    version,
    versionNumber,
    versionPath,
    workspacePath,
    statusPath
  };
}

export function isBoundaryReadyForSync(workspace: ResortWorkspace): boolean {
  return workspace.layers.boundary.status === "complete" && typeof workspace.layers.boundary.artifactPath === "string";
}

export function toManualValidationState(
  value: ManualValidationInput | undefined
): ManualValidationState {
  const boundary = toLayerManualValidationState(value?.layers?.boundary);
  const runs = toLayerManualValidationState(value?.layers?.runs);
  const lifts = toLayerManualValidationState(value?.layers?.lifts);
  const defaultOverall = boundary.validated && runs.validated && lifts.validated;

  return {
    validated: typeof value?.validated === "boolean" ? value.validated : defaultOverall,
    validatedAt: typeof value?.validatedAt === "string" ? value.validatedAt : null,
    validatedBy: typeof value?.validatedBy === "string" ? value.validatedBy : null,
    notes: typeof value?.notes === "string" ? value.notes : null,
    layers: {
      boundary,
      runs,
      lifts
    }
  };
}

export function setLayerManualValidation(args: {
  current: ManualValidationInput | undefined;
  layer: ValidatableLayer;
  validated: boolean;
  validatedAt: string | null;
  validatedBy: string | null;
  notes: string | null;
}): ManualValidationState {
  const current = toManualValidationState(args.current);
  const layers: Record<ValidatableLayer, LayerManualValidationState> = {
    ...current.layers,
    [args.layer]: {
      validated: args.validated,
      validatedAt: args.validatedAt,
      validatedBy: args.validatedBy,
      notes: args.notes
    }
  };
  const validated = layers.boundary.validated && layers.runs.validated && layers.lifts.validated;
  return {
    validated,
    validatedAt: validated ? args.validatedAt : null,
    validatedBy: validated ? args.validatedBy : null,
    notes: validated ? args.notes : null,
    layers
  };
}

function toLayerManualValidationState(value: Partial<LayerManualValidationState> | undefined): LayerManualValidationState {
  return {
    validated: value?.validated === true,
    validatedAt: typeof value?.validatedAt === "string" ? value.validatedAt : null,
    validatedBy: typeof value?.validatedBy === "string" ? value.validatedBy : null,
    notes: typeof value?.notes === "string" ? value.notes : null
  };
}

function formatLayerValidationSummary(value: LayerManualValidationState): string {
  if (!value.validated) {
    return "no";
  }
  const at = value.validatedAt ?? "unknown-time";
  const by = value.validatedBy ?? "unknown";
  return `yes (at=${at}, by=${by})`;
}

type ResortCatalogIndex = {
  schemaVersion: "1.0.0" | "2.0.0";
  release?: ResortCatalogRelease;
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
  compatibility?: ResortCatalogVersionCompatibility;
  checksums?: ResortCatalogVersionChecksums;
};

type ResortCatalogRelease = {
  channel: "stable";
  appVersion: string;
  manifestUrl: string;
  manifestSha256: string;
  createdAt: string;
};

type ResortCatalogVersionCompatibility = {
  minAppVersion: string;
  maxAppVersion?: string;
  supportedPackSchemaVersions?: string[];
};

type ResortCatalogVersionChecksums = {
  packSha256: string;
  pmtilesSha256: string;
  styleSha256: string;
};

type ReleaseManifest = {
  schemaVersion: "1.0.0";
  release: {
    channel: "stable";
    appVersion: string;
    createdAt: string;
  };
  artifacts: Array<{
    kind: "pack" | "pmtiles" | "style";
    resortId: string;
    version: string;
    url: string;
    sha256: string;
    bytes: number;
  }>;
};

async function publishCurrentValidatedVersionToAppCatalog(args: {
  resortKey: string;
  workspacePath: string;
  statusPath: string;
  appPublicRoot: string;
  exportedAt?: string;
}): Promise<{ version: string; outputPath: string; catalogPath: string }> {
  const status = await readStatusShape(args.statusPath);
  const manualValidation = toManualValidationState(status.manualValidation);
  if (!manualValidation.validated) {
    throw new Error("Resort version is not manually validated.");
  }
  const readinessOverall = status.readiness?.overall;
  const readinessIssues = Array.isArray(status.readiness?.issues) ? status.readiness.issues : [];
  if (readinessOverall !== "ready") {
    throw new Error(
      `Resort version is not readiness-complete.${readinessIssues.length > 0 ? ` Issues: ${readinessIssues.join("; ")}` : ""}`
    );
  }

  const workspace = await readResortWorkspace(args.workspacePath);
  const versionPath = dirname(args.workspacePath);
  const version = typeof status.version === "string" && status.version.trim().length > 0 ? status.version : basename(versionPath);
  const exportedAt = args.exportedAt ?? new Date().toISOString();

  const publicRoot = resolve(args.appPublicRoot);
  const packsDir = join(publicRoot, "packs");
  const catalogDir = join(publicRoot, "resort-packs");
  const outputFileName = `${args.resortKey}.latest.validated.json`;
  const outputPath = join(packsDir, outputFileName);
  const outputUrl = `/packs/${outputFileName}`;
  const appVersion = await resolvePublishedAppVersion(publicRoot);
  const manifestUrl = "/releases/stable-manifest.json";
  await publishBasemapAssetsForVersion({
    versionPath,
    publicRoot,
    resortKey: args.resortKey
  });

  const boundary = await readLayerArtifactJson(versionPath, workspace.layers.boundary.artifactPath);
  const areas = await readLayerArtifactJson(versionPath, workspace.layers.areas?.artifactPath);
  const contours = await readLayerArtifactJson(versionPath, workspace.layers.contours?.artifactPath);
  const peaks = await readLayerArtifactJson(versionPath, workspace.layers.peaks?.artifactPath);
  const runs = await readLayerArtifactJson(versionPath, workspace.layers.runs.artifactPath);
  const lifts = await readLayerArtifactJson(versionPath, workspace.layers.lifts.artifactPath);

  const bundle = {
    schemaVersion: "1.0.0",
    export: {
      resortKey: args.resortKey,
      version,
      exportedAt
    },
    status,
    workspace,
    layers: {
      boundary,
      areas,
      contours,
      peaks,
      runs,
      lifts
    }
  };

  await mkdir(packsDir, { recursive: true });
  await mkdir(catalogDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const checksums = {
    packSha256: await sha256ForFile(outputPath),
    pmtilesSha256: await sha256ForFile(join(publicRoot, "packs", args.resortKey, "base.pmtiles")),
    styleSha256: await sha256ForFile(join(publicRoot, "packs", args.resortKey, "style.json"))
  } satisfies ResortCatalogVersionChecksums;

  const catalogPath = join(catalogDir, "index.json");
  const catalog = await readCatalogIndex(catalogPath);
  const resortName = status.query?.name?.trim() || args.resortKey;
  const updatedResorts = catalog.resorts.filter((entry) => entry.resortId !== args.resortKey);
  updatedResorts.push({
    resortId: args.resortKey,
    resortName,
    versions: [
      {
        version,
        approved: true,
        packUrl: outputUrl,
        createdAt: exportedAt,
        compatibility: {
          minAppVersion: appVersion,
          supportedPackSchemaVersions: ["1.0.0"]
        },
        checksums
      }
    ]
  });
  updatedResorts.sort((left, right) => left.resortName.localeCompare(right.resortName));
  const releaseBase: ResortCatalogRelease = {
    channel: "stable",
    appVersion,
    manifestUrl,
    manifestSha256: "0".repeat(64),
    createdAt: exportedAt
  };
  let nextCatalog: ResortCatalogIndex = {
    schemaVersion: "2.0.0",
    release: releaseBase,
    resorts: updatedResorts
  };
  await writeFile(
    catalogPath,
    `${JSON.stringify(nextCatalog, null, 2)}\n`,
    "utf8"
  );
  const manifestPath = join(publicRoot, "releases", "stable-manifest.json");
  await writeStableReleaseManifest({
    manifestPath,
    appVersion,
    createdAt: exportedAt,
    catalog: nextCatalog,
    publicRoot
  });
  const manifestSha256 = await sha256ForFile(manifestPath);
  nextCatalog = {
    schemaVersion: "2.0.0",
    release: {
      ...releaseBase,
      manifestSha256
    },
    resorts: updatedResorts
  };
  await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");

  return {
    version,
    outputPath,
    catalogPath
  };
}

async function publishBasemapAssetsForVersion(args: {
  versionPath: string;
  publicRoot: string;
  resortKey: string;
}): Promise<void> {
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
  await cp(pmtilesSourcePath, pmtilesDestinationPath);
  await cp(styleSourcePath, styleDestinationPath);
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

async function assertBasemapArtifactsExist(args: {
  label: string;
  files: string[];
}): Promise<void> {
  const missing: string[] = [];
  for (const filePath of args.files) {
    if (!(await isRegularFile(filePath))) {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`${args.label} missing: ${missing.join(", ")}`);
  }
}

async function readLayerArtifactJson(versionPath: string, artifactPath: string | undefined): Promise<unknown | null> {
  if (!artifactPath || artifactPath.trim().length === 0) {
    return null;
  }
  const trimmed = artifactPath.trim();
  const basenameCandidate = basename(trimmed);
  const candidates = trimmed.startsWith("/")
    ? [trimmed, resolve(versionPath, basenameCandidate)]
    : [resolve(versionPath, trimmed), resolve(trimmed), resolve(versionPath, basenameCandidate)];
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      return JSON.parse(raw) as unknown;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

async function readCatalogIndex(path: string): Promise<ResortCatalogIndex> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isCatalogIndex(parsed)) {
      return emptyCatalogIndex();
    }
    return parsed;
  } catch {
    return emptyCatalogIndex();
  }
}

async function deleteResortAndPublishedArtifacts(args: {
  resortKey: string;
  resortPath: string;
  appPublicRoot: string;
}): Promise<void> {
  await rm(args.resortPath, { recursive: true, force: true });
  await unpublishResortArtifacts({
    resortKey: args.resortKey,
    appPublicRoot: args.appPublicRoot
  });
}

async function unpublishResortArtifacts(args: {
  resortKey: string;
  appPublicRoot: string;
}): Promise<void> {
  const publicRoot = resolve(args.appPublicRoot);
  const catalogPath = join(publicRoot, "resort-packs", "index.json");
  const packsDir = join(publicRoot, "packs");
  const publishedBundlePath = join(packsDir, `${args.resortKey}.latest.validated.json`);
  const publishedBasemapDir = join(packsDir, args.resortKey);

  await rm(publishedBundlePath, { force: true });
  await rm(publishedBasemapDir, { recursive: true, force: true });
  const catalog = await readCatalogIndex(catalogPath);
  const filtered = catalog.resorts.filter((entry) => entry.resortId !== args.resortKey);
  if (filtered.length !== catalog.resorts.length || existsSync(catalogPath)) {
    const appVersion = await resolvePublishedAppVersion(publicRoot);
    const releaseBase: ResortCatalogRelease = {
      channel: "stable",
      appVersion,
      manifestUrl: "/releases/stable-manifest.json",
      manifestSha256: "0".repeat(64),
      createdAt: new Date().toISOString()
    };
    let nextCatalog: ResortCatalogIndex = {
      schemaVersion: "2.0.0",
      release: releaseBase,
      resorts: filtered
    };
    await mkdir(dirname(catalogPath), { recursive: true });
    await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
    const manifestPath = join(publicRoot, "releases", "stable-manifest.json");
    await writeStableReleaseManifest({
      manifestPath,
      appVersion,
      createdAt: releaseBase.createdAt,
      catalog: nextCatalog,
      publicRoot
    });
    const manifestSha256 = await sha256ForFile(manifestPath);
    nextCatalog = {
      schemaVersion: "2.0.0",
      release: {
        ...releaseBase,
        manifestSha256
      },
      resorts: filtered
    };
    await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
  }
}

export async function readOfflineBasemapMetrics(args: {
  versionPath: string;
  appPublicRoot: string;
  resortKey: string;
}): Promise<OfflineBasemapMetrics> {
  const generatedPmtilesPath = join(args.versionPath, "basemap", "base.pmtiles");
  const generatedStylePath = join(args.versionPath, "basemap", "style.json");
  const publishedPmtilesPath = join(args.appPublicRoot, "packs", args.resortKey, "base.pmtiles");
  const publishedStylePath = join(args.appPublicRoot, "packs", args.resortKey, "style.json");

  const generated = await inspectOfflineBasemapReadiness({
    pmtilesPath: generatedPmtilesPath,
    stylePath: generatedStylePath
  });
  const published = await inspectOfflineBasemapReadiness({
    pmtilesPath: publishedPmtilesPath,
    stylePath: publishedStylePath
  });

  return {
    generated: generated.offlineReady,
    published: published.offlineReady,
    generatedPmtiles: generated.pmtilesReady,
    generatedStyle: generated.styleReady,
    publishedPmtiles: published.pmtilesReady,
    publishedStyle: published.styleReady,
    generatedPmtilesBytes: await readFileSizeBytes(generatedPmtilesPath),
    generatedStyleBytes: await readFileSizeBytes(generatedStylePath),
    publishedPmtilesBytes: await readFileSizeBytes(publishedPmtilesPath),
    publishedStyleBytes: await readFileSizeBytes(publishedStylePath)
  };
}

async function isOfflineReadyBasemapAssets(pmtilesPath: string, stylePath: string): Promise<boolean> {
  const readiness = await inspectOfflineBasemapReadiness({ pmtilesPath, stylePath });
  return readiness.offlineReady;
}

async function assertOfflineReadyBasemapAssets(args: {
  pmtilesPath: string;
  stylePath: string;
  label: string;
}): Promise<void> {
  const readiness = await inspectOfflineBasemapReadiness({
    pmtilesPath: args.pmtilesPath,
    stylePath: args.stylePath
  });
  if (readiness.offlineReady) {
    return;
  }

  throw new Error(`${args.label}: ${readiness.issues.join("; ")}`);
}

async function buildSharedBasemapFromProvider(args: {
  workspace: ResortWorkspace;
  versionPath: string;
  resortsRoot: string;
  resortKey: string;
}): Promise<void> {
  const provider = await readBasemapProviderConfig();
  if (provider.provider !== "openmaptiles-planetiler") {
    throw new Error(`Unsupported basemap provider: ${provider.provider}`);
  }

  const boundaryArtifactPath = await resolveBoundaryArtifactPath(args.workspace, args.versionPath);
  const boundaryRing = await readBoundaryRingFromArtifact(boundaryArtifactPath);
  const bbox = computeBufferedBbox(boundaryRing, provider.bufferMeters);
  const centerLon = (bbox.minLon + bbox.maxLon) / 2;
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;

  const sharedBasemapDir = join(args.resortsRoot, args.resortKey, "basemap");
  await mkdir(sharedBasemapDir, { recursive: true });
  const targetPmtiles = join(sharedBasemapDir, "base.pmtiles");
  const targetStyle = join(sharedBasemapDir, "style.json");
  const planetilerDataDir = resolve(args.resortsRoot, ".cache", "planetiler");
  await mkdir(planetilerDataDir, { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "ptk-basemap-provider-"));
  const boundaryGeojsonPath = join(tempDir, "boundary.geojson");
  const planetilerJarPath = resolvePlanetilerJarPath();
  const countryCode = resolveResortCountryCode(args.workspace, args.resortKey);
  console.log(`Resolving source extract for country=${countryCode}...`);
  const osmExtractPath = provider.planetilerCommand.includes("{osmExtractPath}")
    ? await resolveGeofabrikExtractPath({
        countryCode,
        cacheDir: join(args.resortsRoot, ".cache", "geofabrik"),
        locationLon: centerLon,
        locationLat: centerLat,
        onProgress: (message) => console.log(message)
      })
    : "";
  await writeFile(
    boundaryGeojsonPath,
    `${JSON.stringify(
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [boundaryRing]
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  try {
    const command = ensurePlanetilerRuntimeDefaults(
      renderBasemapProviderCommand(provider.planetilerCommand, {
        resortKey: args.resortKey,
        minLon: bbox.minLon,
        minLat: bbox.minLat,
        maxLon: bbox.maxLon,
        maxLat: bbox.maxLat,
        bboxCsv: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
        bufferMeters: provider.bufferMeters,
        maxZoom: provider.maxZoom,
        outputPmtiles: targetPmtiles,
        outputStyle: targetStyle,
        boundaryGeojson: boundaryGeojsonPath,
        osmExtractPath,
        planetilerJarPath,
        planetilerDataDir
      }),
      {
        downloadDir: join(planetilerDataDir, "sources"),
        tempDir: join(planetilerDataDir, "tmp")
      }
    );
    console.log("Running basemap provider command...");
    await runShellCommand(command, { cwd: process.cwd() });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  if (!(await isRegularFile(targetStyle))) {
    await writeDefaultOfflineStyle({
      stylePath: targetStyle,
      maxZoom: provider.maxZoom
    });
  }

  await assertOfflineReadyBasemapAssets({
    pmtilesPath: targetPmtiles,
    stylePath: targetStyle,
    label: "Shared resort basemap is not offline-ready"
  });
}

function resolvePlanetilerJarPath(): string {
  const configured = process.env.PTK_PLANETILER_JAR?.trim();
  if (configured && existsSync(configured)) {
    return configured;
  }
  const candidates = [
    resolve(process.cwd(), "tools/bin/planetiler.jar"),
    resolve(process.cwd(), "../bin/planetiler.jar"),
    resolve(process.cwd(), "../../tools/bin/planetiler.jar")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "Planetiler jar not found. Expected one of: tools/bin/planetiler.jar, ../bin/planetiler.jar, ../../tools/bin/planetiler.jar. " +
      "Install it with: mkdir -p tools/bin && curl -L https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar -o tools/bin/planetiler.jar"
  );
}

function resolveResortCountryCode(workspace: ResortWorkspace, resortKey: string): string {
  const workspaceCode = workspace.resort.query.country.trim().toUpperCase();
  if (/^[A-Z]{2}$/u.test(workspaceCode)) {
    return workspaceCode;
  }
  const prefix = resortKey.split("_")[0]?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{2}$/u.test(prefix)) {
    return prefix;
  }
  throw new Error(`Unable to resolve resort country code from workspace or resort key '${resortKey}'.`);
}

export async function resolveGeofabrikExtractPath(args: {
  countryCode: string;
  cacheDir: string;
  locationLon?: number;
  locationLat?: number;
  fetchJsonFn?: typeof resilientFetchJson;
  fetchFn?: typeof fetch;
  onProgress?: (message: string) => void;
}): Promise<string> {
  const countryCode = args.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) {
    throw new Error(`Invalid country code '${args.countryCode}'. Expected ISO-3166 alpha-2 (example: CA).`);
  }

  const fetchJsonFn = args.fetchJsonFn ?? resilientFetchJson;
  const fetchFn = args.fetchFn ?? fetch;
  const index = (await fetchJsonFn({
    url: "https://download.geofabrik.de/index-v1.json",
    cache: {
      dir: args.cacheDir,
      ttlMs: 24 * 60 * 60 * 1000,
      key: "geofabrik:index-v1"
    }
  })) as unknown;
  const selected = selectGeofabrikExtract(index, countryCode, {
    lon: args.locationLon,
    lat: args.locationLat
  });
  if (!selected) {
    throw new Error(`No Geofabrik extract found for country code '${countryCode}'.`);
  }
  args.onProgress?.(`Geofabrik extract selected: ${selected.id}`);

  const extractPath = join(args.cacheDir, `${selected.id.replace(/[\/]/gu, "_")}.osm.pbf`);
  if (await hasNonEmptyFile(extractPath)) {
    args.onProgress?.(`Using cached extract: ${extractPath}`);
    return extractPath;
  }

  await mkdir(args.cacheDir, { recursive: true });
  await downloadBinaryWithRetries({
    url: selected.pbfUrl,
    outputPath: extractPath,
    fetchFn,
    onProgress: args.onProgress
  });
  args.onProgress?.(`Saved extract: ${extractPath}`);
  return extractPath;
}

type GeofabrikSelection = {
  id: string;
  pbfUrl: string;
};

function selectGeofabrikExtract(
  index: unknown,
  countryCode: string,
  location?: { lon?: number; lat?: number }
): GeofabrikSelection | null {
  if (typeof index !== "object" || index === null) {
    throw new Error("Invalid Geofabrik index payload.");
  }
  const features = (index as { features?: unknown }).features;
  if (!Array.isArray(features)) {
    throw new Error("Invalid Geofabrik index payload: missing features.");
  }

  const candidates: Array<{
    id: string;
    pbfUrl: string;
    score: number;
    depth: number;
    containsLocation: boolean;
  }> = [];

  for (const feature of features) {
    if (typeof feature !== "object" || feature === null) {
      continue;
    }
    const properties = (feature as { properties?: unknown }).properties;
    if (typeof properties !== "object" || properties === null) {
      continue;
    }
    const props = properties as Record<string, unknown>;
    const id = typeof props.id === "string" ? props.id.trim() : "";
    const pbfUrl = readGeofabrikPbfUrl(props.urls);
    if (!id || !pbfUrl) {
      continue;
    }
    const iso1 = readIsoCodes(props["iso3166-1:alpha2"] ?? props["iso3166-1"]);
    const iso2 = readIsoCodes(props["iso3166-2"]);
    const matchesCountry = iso1.includes(countryCode) || iso2.some((code) => code.startsWith(`${countryCode}-`));
    if (!matchesCountry) {
      continue;
    }
    const depth = id.split("/").filter((segment) => segment.length > 0).length;
    const isSubdivision = iso2.some((code) => code.startsWith(`${countryCode}-`));
    const containsLocation = featureContainsLocation(feature, location);
    candidates.push({
      id,
      pbfUrl,
      depth,
      score: isSubdivision ? 2 : 1,
      containsLocation
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.containsLocation !== b.containsLocation) {
      return a.containsLocation ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.depth !== a.depth) {
      return b.depth - a.depth;
    }
    return a.id.localeCompare(b.id);
  });

  const top = candidates[0];
  if (!top) {
    return null;
  }
  return { id: top.id, pbfUrl: top.pbfUrl };
}

function featureContainsLocation(
  feature: unknown,
  location: { lon?: number; lat?: number } | undefined
): boolean {
  const lonRaw = location?.lon;
  const latRaw = location?.lat;
  if (!Number.isFinite(lonRaw) || !Number.isFinite(latRaw)) {
    return false;
  }
  const lon = Number(lonRaw);
  const lat = Number(latRaw);
  if (typeof feature !== "object" || feature === null) {
    return false;
  }

  const geometryRaw = (feature as { geometry?: unknown }).geometry;
  if (typeof geometryRaw === "object" && geometryRaw !== null) {
    const geometry = geometryRaw as { type?: unknown; coordinates?: unknown };
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      return polygonContainsPoint(geometry.coordinates, lon, lat);
    }
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      for (const polygon of geometry.coordinates) {
        if (Array.isArray(polygon) && polygonContainsPoint(polygon, lon, lat)) {
          return true;
        }
      }
    }
  }

  const bboxRaw = (feature as { bbox?: unknown }).bbox;
  if (!Array.isArray(bboxRaw) || bboxRaw.length < 4) {
    return false;
  }
  const minLon = Number(bboxRaw[0]);
  const minLat = Number(bboxRaw[1]);
  const maxLon = Number(bboxRaw[2]);
  const maxLat = Number(bboxRaw[3]);
  if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) {
    return false;
  }
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function polygonContainsPoint(polygon: unknown, lon: number, lat: number): boolean {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return false;
  }
  const outer = polygon[0];
  if (!ringContainsPoint(outer, lon, lat)) {
    return false;
  }
  for (let i = 1; i < polygon.length; i += 1) {
    if (ringContainsPoint(polygon[i], lon, lat)) {
      return false;
    }
  }
  return true;
}

function ringContainsPoint(ring: unknown, lon: number, lat: number): boolean {
  if (!Array.isArray(ring) || ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const pointI = ring[i];
    const pointJ = ring[j];
    if (!Array.isArray(pointI) || !Array.isArray(pointJ) || pointI.length < 2 || pointJ.length < 2) {
      continue;
    }
    const xi = Number(pointI[0]);
    const yi = Number(pointI[1]);
    const xj = Number(pointJ[0]);
    const yj = Number(pointJ[1]);
    if (![xi, yi, xj, yj].every((value) => Number.isFinite(value))) {
      continue;
    }
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function readGeofabrikPbfUrl(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const pbf = (value as { pbf?: unknown }).pbf;
  if (typeof pbf !== "string") {
    return null;
  }
  const normalized = pbf.trim();
  if (!/^https?:\/\//iu.test(normalized)) {
    return null;
  }
  return normalized;
}

function readIsoCodes(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/u)
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
      .filter((entry) => entry.length > 0);
  }
  return [];
}

async function hasNonEmptyFile(path: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    return metadata.isFile() && metadata.size > 0;
  } catch {
    return false;
  }
}

async function downloadBinaryWithRetries(args: {
  url: string;
  outputPath: string;
  fetchFn: typeof fetch;
  onProgress?: (message: string) => void;
}): Promise<void> {
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      args.onProgress?.(`Downloading extract (attempt ${attempt}/4)...`);
      const response = await args.fetchFn(args.url);
      if (!response.ok) {
        if (!retryableStatuses.has(response.status) || attempt === 4) {
          throw new Error(`HTTP ${response.status}`);
        }
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      const payload = new Uint8Array(await response.arrayBuffer());
      if (payload.byteLength === 0) {
        throw new Error("downloaded file is empty");
      }
      await writeFile(args.outputPath, payload);
      return;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === 4) {
        break;
      }
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Failed to download Geofabrik extract: ${lastError}`);
}

async function writeDefaultOfflineStyle(args: { stylePath: string; maxZoom: number }): Promise<void> {
  const style = {
    version: 8,
    sources: {
      basemap: {
        type: "vector",
        url: "pmtiles://./base.pmtiles"
      }
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#dce8ef" } },
      { id: "landcover", type: "fill", source: "basemap", "source-layer": "landcover", paint: { "fill-color": "#d6ead0" } },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        paint: { "fill-color": "#a8cfe8", "fill-opacity": 0.9 }
      },
      {
        id: "waterway",
        type: "line",
        source: "basemap",
        "source-layer": "waterway",
        paint: {
          "line-color": "#7fb4d7",
          "line-opacity": 0.75,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.5,
            13,
            0.9,
            15,
            1.4
          ]
        }
      },
      {
        id: "water-name",
        type: "symbol",
        source: "basemap",
        "source-layer": "water_name",
        minzoom: 11,
        layout: {
          "text-field": ["coalesce", ["get", "name_en"], ["get", "name"], ""],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            10,
            14,
            12,
            15,
            13
          ],
          "symbol-placement": "line",
          "text-letter-spacing": 0.02
        },
        paint: {
          "text-color": "#4f83a8",
          "text-opacity": 0.85,
          "text-halo-color": "#eef5fa",
          "text-halo-width": 0.8,
          "text-halo-blur": 0.2
        }
      },
      {
        id: "transportation",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        paint: { "line-color": "#ffffff", "line-width": 1.2 }
      },
      {
        id: "boundary",
        type: "line",
        source: "basemap",
        "source-layer": "boundary",
        paint: { "line-color": "#9aa5ad", "line-width": 1 }
      }
    ],
    metadata: {
      "patrol-toolkit:maxZoom": args.maxZoom
    }
  };
  await writeFile(args.stylePath, `${JSON.stringify(style, null, 2)}\n`, "utf8");
}

export async function resolveBoundaryArtifactPath(workspace: ResortWorkspace, versionPath: string): Promise<string> {
  const boundaryPath = workspace.layers.boundary.artifactPath;
  if (!boundaryPath) {
    throw new Error("Boundary artifact path is missing.");
  }
  if (boundaryPath.startsWith("/")) {
    return boundaryPath;
  }
  const candidates = [resolve(versionPath, boundaryPath), join(versionPath, basename(boundaryPath)), resolve(process.cwd(), boundaryPath)];
  for (const candidate of candidates) {
    if (await isRegularFile(candidate)) {
      return candidate;
    }
  }
  return candidates[0] ?? resolve(versionPath, boundaryPath);
}

export async function readBoundaryRingFromArtifact(path: string): Promise<[number, number][]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return extractBoundaryRing(parsed);
}

export function extractBoundaryRing(input: unknown): [number, number][] {
  if (typeof input !== "object" || input === null) {
    throw new Error("Boundary artifact is not valid GeoJSON.");
  }

  const value = input as {
    type?: unknown;
    geometry?: unknown;
    coordinates?: unknown;
    features?: unknown;
  };

  if (value.type === "FeatureCollection") {
    if (!Array.isArray(value.features) || value.features.length === 0) {
      throw new Error("Boundary FeatureCollection has no features.");
    }
    const rings: [number, number][][] = [];
    for (const feature of value.features) {
      try {
        rings.push(extractBoundaryRing(feature));
      } catch {
        continue;
      }
    }
    if (rings.length === 0) {
      throw new Error("Boundary FeatureCollection has no Polygon or MultiPolygon feature.");
    }
    return pickLargestRing(rings);
  }

  if (value.type === "Feature") {
    if (typeof value.geometry !== "object" || value.geometry === null) {
      throw new Error("Boundary Feature has no geometry.");
    }
    return extractBoundaryRing(value.geometry);
  }

  if (value.type === "Polygon" && Array.isArray(value.coordinates)) {
    const ring = value.coordinates[0];
    if (!Array.isArray(ring)) {
      throw new Error("Boundary polygon has no outer ring.");
    }
    return normalizeBoundaryRing(ring);
  }

  if (value.type === "MultiPolygon") {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      throw new Error("Boundary multipolygon has no polygons.");
    }
    const rings: [number, number][][] = [];
    for (const polygon of value.coordinates) {
      if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) {
        continue;
      }
      try {
        rings.push(normalizeBoundaryRing(polygon[0]));
      } catch {
        continue;
      }
    }
    if (rings.length === 0) {
      throw new Error("Boundary multipolygon has no valid outer ring.");
    }
    return pickLargestRing(rings);
  }

  throw new Error("Boundary artifact does not contain a polygon.");
}

function normalizeBoundaryRing(ring: unknown[]): [number, number][] {
  const points: [number, number][] = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) {
      continue;
    }
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      points.push([lon, lat]);
    }
  }

  if (points.length < 4) {
    throw new Error("Boundary polygon ring has insufficient valid coordinates.");
  }

  return points;
}

function pickLargestRing(rings: [number, number][][]): [number, number][] {
  let largest = rings[0];
  let largestArea = ringAreaAbs(largest);
  for (let i = 1; i < rings.length; i += 1) {
    const area = ringAreaAbs(rings[i] ?? []);
    if (area > largestArea) {
      largest = rings[i] ?? largest;
      largestArea = area;
    }
  }
  return largest;
}

function ringAreaAbs(ring: [number, number][]): number {
  if (ring.length < 3) {
    return 0;
  }
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (!current || !next) {
      continue;
    }
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

export function computeBufferedBbox(
  ring: [number, number][],
  bufferMeters: number
): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  const centerLat = (minLat + maxLat) / 2;
  const latBuffer = bufferMeters / 110_574;
  const lonBuffer = bufferMeters / (111_320 * Math.cos((centerLat * Math.PI) / 180) || 1);
  return {
    minLon: minLon - lonBuffer,
    minLat: minLat - latBuffer,
    maxLon: maxLon + lonBuffer,
    maxLat: maxLat + latBuffer
  };
}

export async function readBasemapProviderConfig(env: NodeJS.ProcessEnv = process.env): Promise<BasemapProviderConfig> {
  const configuredPath = (env.PTK_BASEMAP_CONFIG_PATH ?? "").trim();
  const configPath = configuredPath || (await resolveDefaultBasemapProviderConfigPath());
  const configFile = await readBasemapProviderConfigFile(configPath);

  const providerRaw = String(configFile.provider ?? "openmaptiles-planetiler").trim().toLowerCase();
  if (providerRaw !== "openmaptiles-planetiler") {
    throw new Error(`Unsupported basemap provider '${providerRaw}' in ${configPath}. Supported: openmaptiles-planetiler.`);
  }

  const bufferMeters = configFile.bufferMeters ?? 1000;
  const maxZoom = configFile.maxZoom ?? 15;
  if (maxZoom > 15) {
    throw new Error("Basemap provider config maxZoom must be <= 15 for openmaptiles-planetiler.");
  }
  const planetilerCommand = String(configFile.planetilerCommand ?? "").trim();
  if (!planetilerCommand || /REPLACE_WITH/iu.test(planetilerCommand)) {
    throw new Error(`planetilerCommand is required in ${configPath}. It must build base.pmtiles and style.json for option 9.`);
  }

  return {
    provider: "openmaptiles-planetiler",
    bufferMeters,
    maxZoom,
    planetilerCommand
  };
}

async function resolveDefaultBasemapProviderConfigPath(): Promise<string> {
  const candidates = ["tools/osm-extractor/config/basemap-provider.json", "config/basemap-provider.json"];
  for (const candidate of candidates) {
    if (await isRegularFile(candidate)) {
      return candidate;
    }
  }
  return candidates[0] ?? "tools/osm-extractor/config/basemap-provider.json";
}

async function readBasemapProviderConfigFile(path: string): Promise<BasemapProviderConfigFile> {
  let raw: string;
  try {
    raw = await readFile(resolve(path), "utf8");
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return {};
    }
    throw new Error(`Failed to read basemap provider config (${path}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON in basemap provider config (${path}).`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Basemap provider config must be an object (${path}).`);
  }

  const candidate = parsed as {
    provider?: unknown;
    bufferMeters?: unknown;
    maxZoom?: unknown;
    planetilerCommand?: unknown;
  };
  if (candidate.provider !== undefined && typeof candidate.provider !== "string") {
    throw new Error(`Basemap provider config field 'provider' must be a string (${path}).`);
  }
  if (candidate.bufferMeters !== undefined && typeof candidate.bufferMeters !== "number") {
    throw new Error(`Basemap provider config field 'bufferMeters' must be a number (${path}).`);
  }
  if (candidate.maxZoom !== undefined && typeof candidate.maxZoom !== "number") {
    throw new Error(`Basemap provider config field 'maxZoom' must be a number (${path}).`);
  }
  if (candidate.planetilerCommand !== undefined && typeof candidate.planetilerCommand !== "string") {
    throw new Error(`Basemap provider config field 'planetilerCommand' must be a string (${path}).`);
  }

  return {
    provider: typeof candidate.provider === "string" ? candidate.provider : undefined,
    bufferMeters: typeof candidate.bufferMeters === "number" ? candidate.bufferMeters : undefined,
    maxZoom: typeof candidate.maxZoom === "number" ? candidate.maxZoom : undefined,
    planetilerCommand: typeof candidate.planetilerCommand === "string" ? candidate.planetilerCommand : undefined
  };
}

function renderBasemapProviderCommand(
  template: string,
  values: {
    resortKey: string;
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
    bboxCsv: string;
    bufferMeters: number;
    maxZoom: number;
    outputPmtiles: string;
    outputStyle: string;
    boundaryGeojson: string;
    osmExtractPath: string;
    planetilerJarPath: string;
    planetilerDataDir: string;
  }
): string {
  let rendered = template;
  const replacements: Record<string, string> = {
    "{resortKey}": shellEscape(values.resortKey),
    "{minLon}": String(values.minLon),
    "{minLat}": String(values.minLat),
    "{maxLon}": String(values.maxLon),
    "{maxLat}": String(values.maxLat),
    "{bboxCsv}": shellEscape(values.bboxCsv),
    "{bufferMeters}": String(values.bufferMeters),
    "{maxZoom}": String(values.maxZoom),
    "{outputPmtiles}": shellEscape(values.outputPmtiles),
    "{outputStyle}": shellEscape(values.outputStyle),
    "{boundaryGeojson}": shellEscape(values.boundaryGeojson),
    "{osmExtractPath}": shellEscape(values.osmExtractPath),
    "{planetilerJarPath}": shellEscape(values.planetilerJarPath),
    "{planetilerDataDir}": shellEscape(values.planetilerDataDir)
  };

  for (const [token, replacement] of Object.entries(replacements)) {
    rendered = rendered.split(token).join(replacement);
  }

  return rendered;
}

export function ensurePlanetilerRuntimeDefaults(
  command: string,
  paths: { downloadDir: string; tempDir: string }
): string {
  let normalized = command.trim();
  if (!/planetiler|openmaptiles/iu.test(normalized)) {
    return normalized;
  }

  if (/--download=(true|false)\b/iu.test(normalized)) {
    normalized = normalized.replace(/--download=(true|false)\b/iu, "--download=true");
  } else {
    normalized = `${normalized} --download=true`;
  }

  if (!/--download_dir=/iu.test(normalized)) {
    normalized = `${normalized} --download_dir=${shellEscape(paths.downloadDir)}`;
  }

  if (!/--tmpdir=/iu.test(normalized)) {
    normalized = `${normalized} --tmpdir=${shellEscape(paths.tempDir)}`;
  }

  if (/--force=(true|false)\b/iu.test(normalized)) {
    normalized = normalized.replace(/--force=(true|false)\b/iu, "--force=true");
  } else {
    normalized = `${normalized} --force=true`;
  }

  return normalized;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/gu, `'\\''`)}'`;
}

async function runShellCommand(command: string, options: { cwd: string }): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("/bin/sh", ["-lc", command], {
      cwd: options.cwd,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Basemap provider command failed with exit code ${String(code)}.`));
    });
  });
}

async function inspectOfflineBasemapReadiness(paths: {
  pmtilesPath: string;
  stylePath: string;
}): Promise<BasemapOfflineReadiness> {
  const pmtiles = await inspectPmtilesArchive(paths.pmtilesPath);
  const style = await inspectOfflineStyle(paths.stylePath);
  return {
    pmtilesReady: pmtiles.ok,
    styleReady: style.ok,
    offlineReady: pmtiles.ok && style.ok,
    issues: [...pmtiles.issues, ...style.issues]
  };
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

async function isRegularFile(path: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    return metadata.isFile();
  } catch {
    return false;
  }
}

async function readFileSizeBytes(path: string): Promise<number | null> {
  try {
    const metadata = await stat(path);
    if (!metadata.isFile()) {
      return null;
    }
    return metadata.size;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return "(n/a)";
  }

  if (bytes < 1024) {
    return `(${bytes} B)`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `(${kib.toFixed(1)} KiB)`;
  }

  const mib = kib / 1024;
  return `(${mib.toFixed(2)} MiB)`;
}

function isCatalogIndex(input: unknown): input is ResortCatalogIndex {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const value = input as { schemaVersion?: unknown; resorts?: unknown; release?: unknown };
  if ((value.schemaVersion !== "1.0.0" && value.schemaVersion !== "2.0.0") || !Array.isArray(value.resorts)) {
    return false;
  }

  if (value.schemaVersion === "2.0.0") {
    if (typeof value.release !== "object" || value.release === null) {
      return false;
    }
    const release = value.release as {
      channel?: unknown;
      appVersion?: unknown;
      manifestUrl?: unknown;
      manifestSha256?: unknown;
      createdAt?: unknown;
    };
    if (
      release.channel !== "stable" ||
      typeof release.appVersion !== "string" ||
      typeof release.manifestUrl !== "string" ||
      typeof release.manifestSha256 !== "string" ||
      typeof release.createdAt !== "string"
    ) {
      return false;
    }
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
      const data = version as {
        version?: unknown;
        approved?: unknown;
        packUrl?: unknown;
        createdAt?: unknown;
        compatibility?: unknown;
        checksums?: unknown;
      };
      return (
        typeof data.version === "string" &&
        typeof data.approved === "boolean" &&
        typeof data.packUrl === "string" &&
        typeof data.createdAt === "string"
      );
    });
  });
}

function emptyCatalogIndex(): ResortCatalogIndex {
  return {
    schemaVersion: "2.0.0",
    release: {
      channel: "stable",
      appVersion: "0.0.1",
      manifestUrl: "/releases/stable-manifest.json",
      manifestSha256: "0".repeat(64),
      createdAt: new Date(0).toISOString()
    },
    resorts: []
  };
}

async function resolvePublishedAppVersion(publicRoot: string): Promise<string> {
  const packagePath = resolve(publicRoot, "..", "package.json");
  try {
    const raw = await readFile(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version === "string" && /^(\d+)\.(\d+)\.(\d+)$/u.test(parsed.version)) {
      return parsed.version;
    }
  } catch {
    // fall through
  }
  return "0.0.1";
}

async function sha256ForFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function writeStableReleaseManifest(args: {
  manifestPath: string;
  appVersion: string;
  createdAt: string;
  catalog: ResortCatalogIndex;
  publicRoot: string;
}): Promise<void> {
  const artifacts: ReleaseManifest["artifacts"] = [];
  for (const resort of args.catalog.resorts) {
    const version = resort.versions[0];
    if (!version || !version.checksums) {
      continue;
    }
    const packRelativePath = version.packUrl.replace(/^\/+/u, "");
    const packPath = join(args.publicRoot, packRelativePath);
    const [packStats, pmtilesStats, styleStats] = await Promise.all([
      stat(packPath).catch(() => null),
      stat(join(args.publicRoot, "packs", resort.resortId, "base.pmtiles")).catch(() => null),
      stat(join(args.publicRoot, "packs", resort.resortId, "style.json")).catch(() => null)
    ]);
    if (packStats) {
      artifacts.push({
        kind: "pack",
        resortId: resort.resortId,
        version: version.version,
        url: version.packUrl,
        sha256: version.checksums.packSha256,
        bytes: packStats.size
      });
    }
    if (pmtilesStats) {
      artifacts.push({
        kind: "pmtiles",
        resortId: resort.resortId,
        version: version.version,
        url: `/packs/${resort.resortId}/base.pmtiles`,
        sha256: version.checksums.pmtilesSha256,
        bytes: pmtilesStats.size
      });
    }
    if (styleStats) {
      artifacts.push({
        kind: "style",
        resortId: resort.resortId,
        version: version.version,
        url: `/packs/${resort.resortId}/style.json`,
        sha256: version.checksums.styleSha256,
        bytes: styleStats.size
      });
    }
  }

  const manifest: ReleaseManifest = {
    schemaVersion: "1.0.0",
    release: {
      channel: "stable",
      appVersion: args.appVersion,
      createdAt: args.createdAt
    },
    artifacts
  };
  await mkdir(dirname(args.manifestPath), { recursive: true });
  await writeFile(args.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function toCanonicalResortKey(resortKey: string): string {
  const parts = resortKey.split("_").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return resortKey;
  }
  const country = parts[0]?.toUpperCase() ?? resortKey;
  const rest = parts
    .slice(1)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`);
  return [country, ...rest].join("_");
}

export async function canonicalizeResortKeys(rootPath: string): Promise<void> {
  let rootEntries;
  try {
    rootEntries = await readdir(rootPath, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return;
    }
    throw error;
  }

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const currentKey = entry.name;
    const canonicalKey = toCanonicalResortKey(currentKey);
    if (canonicalKey === currentKey) {
      continue;
    }
    const from = join(rootPath, currentKey);
    const to = join(rootPath, canonicalKey);
    try {
      await rename(from, to);
      console.log(`Renamed resort key: ${currentKey} -> ${canonicalKey}`);
    } catch (error: unknown) {
      if (isPathExistsError(error)) {
        console.log(`Cannot rename ${currentKey} -> ${canonicalKey}: target already exists.`);
        continue;
      }
      throw error;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as NodeJS.ErrnoException;
  return candidate.code === "ENOENT";
}

function isPathExistsError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as NodeJS.ErrnoException;
  return candidate.code === "EEXIST";
}
