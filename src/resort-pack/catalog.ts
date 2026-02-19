import { loadResortPackFromObject } from "./loader";
import type { ResortPack } from "./types";

export type ResortCatalogVersion = {
  version: string;
  approved: boolean;
  packUrl: string;
  createdAt?: string;
};

export type ResortCatalogResort = {
  resortId: string;
  resortName: string;
  versions: ResortCatalogVersion[];
};

export type ResortCatalog = {
  schemaVersion: "1.0.0";
  resorts: ResortCatalogResort[];
};

export type SelectableResortPack = {
  resortId: string;
  resortName: string;
  version: string;
  packUrl: string;
};

const DEFAULT_CATALOG_URL = "/resort-packs/index.json";

export async function loadResortCatalog(url = DEFAULT_CATALOG_URL): Promise<ResortCatalog> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load resort catalog (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return assertResortCatalog(payload);
}

export function selectLatestEligibleVersions(catalog: ResortCatalog): SelectableResortPack[] {
  const selected: SelectableResortPack[] = [];

  for (const resort of catalog.resorts) {
    if (resort.versions.length === 1) {
      const single = resort.versions[0];
      if (!single) {
        continue;
      }

      selected.push({
        resortId: resort.resortId,
        resortName: resort.resortName,
        version: single.version,
        packUrl: single.packUrl
      });
      continue;
    }

    const approved = resort.versions.filter((entry) => entry.approved);
    const latestApproved = approved.sort(compareCatalogVersionDesc)[0];

    if (!latestApproved) {
      continue;
    }

    selected.push({
      resortId: resort.resortId,
      resortName: resort.resortName,
      version: latestApproved.version,
      packUrl: latestApproved.packUrl
    });
  }

  return selected.sort((left, right) => left.resortName.localeCompare(right.resortName));
}

export async function loadPackFromCatalogEntry(entry: SelectableResortPack): Promise<ResortPack> {
  const response = await fetch(entry.packUrl);
  if (!response.ok) {
    throw new Error(`Unable to load resort pack ${entry.resortId} (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  const result = loadResortPackFromObject(payload);
  if (!result.ok) {
    const firstError = result.errors[0];
    const reason = firstError ? `${firstError.path} ${firstError.message}` : "invalid Resort Pack.";
    throw new Error(`Invalid resort pack for ${entry.resortId}: ${reason}`);
  }

  return result.value;
}

function assertResortCatalog(input: unknown): ResortCatalog {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: expected object.");
  }

  if (input.schemaVersion !== "1.0.0") {
    throw new Error("Invalid resort catalog: unsupported schemaVersion.");
  }

  if (!Array.isArray(input.resorts)) {
    throw new Error("Invalid resort catalog: resorts must be an array.");
  }

  const resorts = input.resorts.map(assertCatalogResort);
  return {
    schemaVersion: "1.0.0",
    resorts
  };
}

function assertCatalogResort(input: unknown): ResortCatalogResort {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: resort entry must be object.");
  }

  if (!isNonEmptyString(input.resortId)) {
    throw new Error("Invalid resort catalog: resortId is required.");
  }

  if (!isNonEmptyString(input.resortName)) {
    throw new Error("Invalid resort catalog: resortName is required.");
  }

  if (!Array.isArray(input.versions) || input.versions.length === 0) {
    throw new Error("Invalid resort catalog: resort versions are required.");
  }

  return {
    resortId: input.resortId,
    resortName: input.resortName,
    versions: input.versions.map(assertCatalogVersion)
  };
}

function assertCatalogVersion(input: unknown): ResortCatalogVersion {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: version entry must be object.");
  }

  if (!isNonEmptyString(input.version)) {
    throw new Error("Invalid resort catalog: version is required.");
  }

  if (typeof input.approved !== "boolean") {
    throw new Error("Invalid resort catalog: approved must be boolean.");
  }

  if (!isNonEmptyString(input.packUrl)) {
    throw new Error("Invalid resort catalog: packUrl is required.");
  }

  if (input.createdAt !== undefined && !isNonEmptyString(input.createdAt)) {
    throw new Error("Invalid resort catalog: createdAt must be string when present.");
  }

  return {
    version: input.version,
    approved: input.approved,
    packUrl: input.packUrl,
    createdAt: input.createdAt
  };
}

function compareCatalogVersionDesc(left: ResortCatalogVersion, right: ResortCatalogVersion): number {
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  const leftVersion = parseVersionNumber(left.version);
  const rightVersion = parseVersionNumber(right.version);
  if (leftVersion !== null && rightVersion !== null && leftVersion !== rightVersion) {
    return rightVersion - leftVersion;
  }

  return right.version.localeCompare(left.version);
}

function parseVersionNumber(version: string): number | null {
  const match = /^v(\d+)$/iu.exec(version.trim());
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? "", 10);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
