import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join } from "node:path";
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
    };
    lifts?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
    };
    runs?: {
      status?: "pending" | "running" | "complete" | "failed";
      featureCount?: number | null;
      artifactPath?: string | null;
      checksumSha256?: string | null;
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
    const manuallyValidated =
      latestVersion === null ? null : await readManualValidationFlag(join(resortPath, latestVersion, "status.json"));

    resorts.push({
      resortKey: entry.name,
      latestVersion,
      latestVersionNumber,
      manuallyValidated
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

async function readManualValidationFlag(statusPath: string): Promise<boolean | null> {
  try {
    const raw = await readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as StatusShape;
    const validated = parsed.manualValidation?.validated;
    return typeof validated === "boolean" ? validated : null;
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return null;
    }
    return null;
  }
}

export async function runInteractiveMenu(args: {
  resortsRoot: string;
  searchFn: (query: { name: string; country: string; limit: number }) => Promise<ResortSearchResult>;
}): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await canonicalizeResortKeys(args.resortsRoot);

    let running = true;
    while (running) {
      console.log("Welcome to osm-extractor CLI");
      console.log("Here are your options:");
      console.log("1. Resort list");
      console.log("2. New Resort");
      console.log("3. Exit");

      const selected = (await rl.question("Select option (1-3): ")).trim();
      if (selected === "1") {
        const resorts = await listKnownResorts(args.resortsRoot);
        if (resorts.length === 0) {
          console.log(`No resorts found in '${args.resortsRoot}'.`);
          continue;
        }

        console.log(`Known resorts (${resorts.length}):`);
        for (let index = 0; index < resorts.length; index += 1) {
          const resort = resorts[index];
          if (!resort) {
            continue;
          }
          console.log(formatKnownResortSummary(index + 1, resort));
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
        const rankedCandidates = await rankSearchCandidates(search.candidates, { town });
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
    rl.close();
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

export function formatKnownResortSummary(index: number, resort: KnownResortSummary): string {
  const validated =
    resort.manuallyValidated === null ? "unknown" : resort.manuallyValidated ? "yes" : "no";
  return `${index}. ${resort.resortKey} | latest=${resort.latestVersion ?? "none"} | validated=${validated}`;
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
        checksumSha256: null
      },
      lifts: {
        status: "pending",
        featureCount: null,
        artifactPath: null,
        checksumSha256: null
      },
      runs: {
        status: "pending",
        featureCount: null,
        artifactPath: null,
        checksumSha256: null
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
  rl: ReturnType<typeof createInterface>;
  resortsRoot: string;
  resortKey: string;
  workspacePath: string;
  statusPath: string;
}): Promise<void> {
  let workspacePath = args.workspacePath;
  let statusPath = args.statusPath;

  let keepRunning = true;
  while (keepRunning) {
    console.log(`Resort menu: ${args.resortKey}`);
    console.log("1. See metrics");
    console.log("2. Fetch/update boundary");
    console.log("3. Fetch/update runs");
    console.log("4. Fetch/update lifts");
    console.log("5. Validate boundary");
    console.log("6. Validate runs");
    console.log("7. Validate lifts");
    console.log("8. Re-select resort identity");
    console.log("9. Back");
    const selected = (await args.rl.question("Select option (1-9): ")).trim();

    if (selected === "1") {
      const syncStatus = await readResortSyncStatus(workspacePath);
      await syncStatusFileFromWorkspace({
        workspacePath,
        statusPath
      });
      const status = await readStatusShape(statusPath);
      const manualValidation = toManualValidationState(status.manualValidation);
      console.log(`Sync overall: ${syncStatus.overall}`);
      console.log(
        `Boundary: status=${syncStatus.layers.boundary.status} features=${syncStatus.layers.boundary.featureCount ?? "?"} ready=${syncStatus.layers.boundary.ready ? "yes" : "no"}`
      );
      console.log(
        `Runs: status=${syncStatus.layers.runs.status} features=${syncStatus.layers.runs.featureCount ?? "?"} ready=${syncStatus.layers.runs.ready ? "yes" : "no"}`
      );
      console.log(
        `Lifts: status=${syncStatus.layers.lifts.status} features=${syncStatus.layers.lifts.featureCount ?? "?"} ready=${syncStatus.layers.lifts.ready ? "yes" : "no"}`
      );
      console.log(
        `Boundary validation: ${formatLayerValidationSummary(manualValidation.layers.boundary)}`
      );
      console.log(
        `Runs validation: ${formatLayerValidationSummary(manualValidation.layers.runs)}`
      );
      console.log(
        `Lifts validation: ${formatLayerValidationSummary(manualValidation.layers.lifts)}`
      );
      console.log(
        `Manual validation overall: ${manualValidation.validated ? "yes" : "no"}`
      );
      continue;
    }

    if (selected === "2") {
      let cloned: ClonedResortVersion | null = null;
      try {
        const detection = await detectResortBoundaryCandidates({
          workspacePath,
          searchLimit: 5
        });
        const polygonCandidates = detection.candidates.filter((candidate) => candidate.ring !== null);
        if (polygonCandidates.length === 0) {
          console.log("No valid boundary candidates with polygon geometry were found.");
          continue;
        }

        console.log(`Boundary candidates (${polygonCandidates.length}):`);
        for (let index = 0; index < polygonCandidates.length; index += 1) {
          const candidate = polygonCandidates[index];
          if (!candidate) {
            continue;
          }
          console.log(
            `${index + 1}. ${candidate.displayName} [${candidate.osmType}/${candidate.osmId}] score=${candidate.validation.score} containsCenter=${candidate.validation.containsSelectionCenter ? "yes" : "no"}`
          );
        }
        const rawIndex = (await args.rl.question(`Select boundary (1-${polygonCandidates.length}, 0 to cancel): `)).trim();
        const selectedIndex = parseCandidateSelection(rawIndex, polygonCandidates.length);
        if (selectedIndex === null) {
          console.log("Boundary update cancelled.");
          continue;
        }
        if (selectedIndex === -1) {
          console.log("Invalid boundary selection.");
          continue;
        }

        const picked = polygonCandidates[selectedIndex - 1];
        if (!picked) {
          console.log("Invalid boundary selection.");
          continue;
        }

        if (!picked.validation.containsSelectionCenter) {
          const confirm = (await args.rl.question("Warning: boundary does not contain selected resort center. Continue? (y/N): "))
            .trim()
            .toLowerCase();
          if (confirm !== "y" && confirm !== "yes") {
            console.log("Boundary update cancelled.");
            continue;
          }
        }

        const pickedIndexInDetection = detection.candidates.findIndex(
          (candidate) => candidate.osmType === picked.osmType && candidate.osmId === picked.osmId
        );
        if (pickedIndexInDetection < 0) {
          console.log("Boundary candidate mapping failed.");
          continue;
        }

        cloned = await createNextVersionClone({
          resortsRoot: args.resortsRoot,
          resortKey: args.resortKey,
          workspacePath,
          statusPath
        });

        const result = await setResortBoundary({
          workspacePath: cloned.workspacePath,
          index: pickedIndexInDetection + 1
        });
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

    if (selected === "5" || selected === "6" || selected === "7") {
      const layer: ValidatableLayer = selected === "5" ? "boundary" : selected === "6" ? "runs" : "lifts";
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
      continue;
    }

    if (selected === "8") {
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

    if (selected === "9") {
      keepRunning = false;
      continue;
    }

    console.log("Invalid option. Please select 1, 2, 3, 4, 5, 6, 7, 8, or 9.");
  }
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
} {
  return {
    status: layer.status,
    featureCount: layer.featureCount ?? null,
    artifactPath: layer.artifactPath ?? null,
    checksumSha256: layer.checksumSha256 ?? null
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
