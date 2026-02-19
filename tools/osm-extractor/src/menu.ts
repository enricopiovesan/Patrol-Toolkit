import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
};

type BasemapSourcePaths = {
  pmtilesPath: string;
  stylePath: string;
  sourceLabel: string;
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
    const selected = (await args.rl.question("Select option (1-11): ")).trim();

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
      console.log("- Validation");
      console.log(`  - Boundary: ${formatLayerValidationSummary(manualValidation.layers.boundary)}`);
      console.log(`  - Runs    : ${formatLayerValidationSummary(manualValidation.layers.runs)}`);
      console.log(`  - Lifts   : ${formatLayerValidationSummary(manualValidation.layers.lifts)}`);
      console.log(`  - Overall : ${manualValidation.validated ? "yes" : "no"}`);
      console.log("- Offline basemap");
      console.log(
        `  - Generated: ${offlineBasemap.generated ? "yes" : "no"} (pmtiles=${offlineBasemap.generatedPmtiles ? "yes" : "no"}, style=${offlineBasemap.generatedStyle ? "yes" : "no"})`
      );
      console.log(
        `  - Published: ${offlineBasemap.published ? "yes" : "no"} (pmtiles=${offlineBasemap.publishedPmtiles ? "yes" : "no"}, style=${offlineBasemap.publishedStyle ? "yes" : "no"})`
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

      try {
        const result = await generateBasemapAssetsForVersion({
          resortsRoot: args.resortsRoot,
          appPublicRoot: args.appPublicRoot,
          resortKey: args.resortKey,
          versionPath: dirname(workspacePath)
        });
        if (result.generatedNow) {
          console.log(`Basemap assets generated under ${join(dirname(workspacePath), "basemap")} from ${result.sourceLabel}.`);
        } else {
          console.log(`Basemap assets already present under ${join(dirname(workspacePath), "basemap")}.`);
        }

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
          console.log(`Published resort assets: version=${published.version} pack=${published.outputPath}`);
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

    console.log("Invalid option. Please select 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, or 11.");
  }
}

export async function attachBasemapAssetsToVersion(args: {
  versionPath: string;
  pmtilesSourcePath: string;
  styleSourcePath: string;
}): Promise<void> {
  await assertRegularFile(args.pmtilesSourcePath, "Missing basemap PMTiles");
  await assertRegularFile(args.styleSourcePath, "Missing basemap style");

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
}): Promise<{ generatedNow: boolean; sourceLabel: string }> {
  const targetPmtiles = join(args.versionPath, "basemap", "base.pmtiles");
  const targetStyle = join(args.versionPath, "basemap", "style.json");
  const alreadyGenerated = (await isRegularFile(targetPmtiles)) && (await isRegularFile(targetStyle));
  if (alreadyGenerated) {
    return { generatedNow: false, sourceLabel: "current version basemap" };
  }

  const sourcePaths = await resolveBasemapSourcePaths(args);

  if (!sourcePaths) {
    await generatePlaceholderBasemapAssets(args.versionPath);
    return {
      generatedNow: true,
      sourceLabel: "CLI-generated placeholder basemap"
    };
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
  if ((await isRegularFile(resortBasemap.pmtilesPath)) && (await isRegularFile(resortBasemap.stylePath))) {
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
  if ((await isRegularFile(publishedBasemap.pmtilesPath)) && (await isRegularFile(publishedBasemap.stylePath))) {
    return publishedBasemap;
  }

  return null;
}

async function generatePlaceholderBasemapAssets(versionPath: string): Promise<void> {
  const basemapDir = join(versionPath, "basemap");
  const pmtilesPath = join(basemapDir, "base.pmtiles");
  const stylePath = join(basemapDir, "style.json");

  await mkdir(basemapDir, { recursive: true });
  await writeFile(pmtilesPath, new Uint8Array([80, 84, 75]));
  await writeFile(
    stylePath,
    `${JSON.stringify(
      {
        version: 8,
        name: "Patrol Toolkit CLI Generated Basemap",
        sources: {},
        layers: [
          {
            id: "cli-generated-background",
            type: "background",
            paint: {
              "background-color": "#dce7e4"
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
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
    if ((await isRegularFile(candidate.pmtilesPath)) && (await isRegularFile(candidate.stylePath))) {
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
  const detection = await detectResortBoundaryCandidates({
    workspacePath: args.workspacePath,
    searchLimit: 5
  });
  const polygonCandidates = detection.candidates.filter((candidate) => candidate.ring !== null);
  if (polygonCandidates.length === 0) {
    throw new Error("No valid boundary candidates with polygon geometry were found.");
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
      lifts: toStatusLayer(workspace.layers.lifts)
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
  await publishBasemapAssetsForVersion({
    versionPath,
    publicRoot,
    resortKey: args.resortKey
  });

  const boundary = await readLayerArtifactJson(versionPath, workspace.layers.boundary.artifactPath);
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
      runs,
      lifts
    }
  };

  await mkdir(packsDir, { recursive: true });
  await mkdir(catalogDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

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
        createdAt: exportedAt
      }
    ]
  });
  updatedResorts.sort((left, right) => left.resortName.localeCompare(right.resortName));
  await writeFile(
    catalogPath,
    `${JSON.stringify({ schemaVersion: "1.0.0", resorts: updatedResorts } as ResortCatalogIndex, null, 2)}\n`,
    "utf8"
  );

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

async function readLayerArtifactJson(versionPath: string, artifactPath: string | undefined): Promise<unknown | null> {
  if (!artifactPath || artifactPath.trim().length === 0) {
    return null;
  }
  const candidates = artifactPath.startsWith("/")
    ? [artifactPath]
    : [resolve(versionPath, artifactPath), resolve(artifactPath)];
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
      return { schemaVersion: "1.0.0", resorts: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: "1.0.0", resorts: [] };
  }
}

export async function readOfflineBasemapMetrics(args: {
  versionPath: string;
  appPublicRoot: string;
  resortKey: string;
}): Promise<OfflineBasemapMetrics> {
  const generatedPmtiles = await isRegularFile(join(args.versionPath, "basemap", "base.pmtiles"));
  const generatedStyle = await isRegularFile(join(args.versionPath, "basemap", "style.json"));
  const publishedPmtiles = await isRegularFile(join(args.appPublicRoot, "packs", args.resortKey, "base.pmtiles"));
  const publishedStyle = await isRegularFile(join(args.appPublicRoot, "packs", args.resortKey, "style.json"));

  return {
    generated: generatedPmtiles && generatedStyle,
    published: publishedPmtiles && publishedStyle,
    generatedPmtiles,
    generatedStyle,
    publishedPmtiles,
    publishedStyle
  };
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    return metadata.isFile();
  } catch {
    return false;
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
