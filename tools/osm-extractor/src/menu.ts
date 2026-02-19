import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";
import type { ResortSearchCandidate, ResortSearchResult } from "./resort-search.js";
import { writeResortWorkspace } from "./resort-workspace.js";

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

type StatusShape = {
  manualValidation?: {
    validated?: boolean;
  };
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
        console.log(`Search results (${search.candidates.length}):`);
        for (let index = 0; index < search.candidates.length; index += 1) {
          const candidate = search.candidates[index];
          if (!candidate) {
            continue;
          }
          console.log(formatSearchCandidate(index + 1, candidate));
        }
        if (search.candidates.length === 0) {
          console.log("No resort candidates found.");
          continue;
        }

        const rawIndex = (await rl.question(`Select resort (1-${search.candidates.length}, 0 to cancel): `)).trim();
        const selectedIndex = parseCandidateSelection(rawIndex, search.candidates.length);
        if (selectedIndex === null) {
          console.log("Selection cancelled.");
          continue;
        }
        if (selectedIndex === -1) {
          console.log(`Invalid selection. Please select a number between 1 and ${search.candidates.length}, or 0 to cancel.`);
          continue;
        }

        const picked = search.candidates[selectedIndex - 1];
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

export function formatSearchCandidate(index: number, candidate: ResortSearchCandidate): string {
  const [lon, lat] = candidate.center;
  const region = candidate.region ?? "unknown";
  const country = candidate.countryCode?.toUpperCase() ?? candidate.country ?? "unknown";
  const importance = candidate.importance === null ? "n/a" : candidate.importance.toFixed(3);
  return `${index}. ${candidate.displayName}\n   OSM: ${candidate.osmType}/${candidate.osmId} | Country: ${country} | Region: ${region}\n   Center: ${lat.toFixed(5)},${lon.toFixed(5)} | Importance: ${importance}`;
}

export async function persistResortVersion(args: {
  resortsRoot: string;
  countryCode: string;
  town: string;
  resortName: string;
  candidate: ResortSearchCandidate;
  selectedAt?: string;
  createdAt?: string;
}): Promise<PersistedResortVersion> {
  const resortKey = buildResortKey(args.countryCode, args.town, args.resortName);
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
  return ascii.length > 0 ? ascii : "unknown";
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
      notes: null
    }
  };
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as NodeJS.ErrnoException;
  return candidate.code === "ENOENT";
}
