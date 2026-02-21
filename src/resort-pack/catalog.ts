import { loadResortPackFromObject } from "./loader";
import type { ResortPack } from "./types";
import { APP_VERSION } from "../app-version";

export type ResortCatalogRelease = {
  channel: "stable";
  appVersion: string;
  manifestUrl: string;
  manifestSha256: string;
  createdAt: string;
  notesSummary?: string;
};

export type ResortCatalogVersionCompatibility = {
  minAppVersion: string;
  maxAppVersion?: string;
  supportedPackSchemaVersions?: string[];
};

export type ResortCatalogVersionChecksums = {
  packSha256: string;
  pmtilesSha256: string;
  styleSha256: string;
};

export type ResortCatalogVersion = {
  version: string;
  approved: boolean;
  packUrl: string;
  createdAt?: string;
  compatibility?: ResortCatalogVersionCompatibility;
  checksums?: ResortCatalogVersionChecksums;
};

export type ResortCatalogResort = {
  resortId: string;
  resortName: string;
  versions: ResortCatalogVersion[];
};

export type ResortCatalog = {
  schemaVersion: "1.0.0" | "2.0.0";
  release?: ResortCatalogRelease;
  resorts: ResortCatalogResort[];
};

export type SelectableResortPack = {
  resortId: string;
  resortName: string;
  version: string;
  packUrl: string;
  createdAt?: string;
  compatibility?: ResortCatalogVersionCompatibility;
  checksums?: ResortCatalogVersionChecksums;
};

const DEFAULT_CATALOG_URL = "/resort-packs/index.json";

export async function loadResortCatalog(url = DEFAULT_CATALOG_URL): Promise<ResortCatalog> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load resort catalog (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return assertResortCatalog(payload);
}

export function selectLatestEligibleVersions(
  catalog: ResortCatalog,
  options?: {
    appVersion?: string;
    supportedPackSchemaVersion?: string;
  }
): SelectableResortPack[] {
  const appVersion = options?.appVersion ?? APP_VERSION;
  const supportedPackSchemaVersion = options?.supportedPackSchemaVersion ?? "1.0.0";
  const selected: SelectableResortPack[] = [];

  for (const resort of catalog.resorts) {
    const eligibleByCompatibility = resort.versions.filter((entry) =>
      isCatalogVersionCompatible(entry, {
        appVersion,
        supportedPackSchemaVersion
      })
    );

    if (eligibleByCompatibility.length === 1) {
      const single = eligibleByCompatibility[0];
      if (!single) {
        continue;
      }

      selected.push({
        resortId: resort.resortId,
        resortName: resort.resortName,
        version: single.version,
        packUrl: single.packUrl,
        createdAt: single.createdAt,
        compatibility: single.compatibility,
        checksums: single.checksums
      });
      continue;
    }

    const approved = eligibleByCompatibility.filter((entry) => entry.approved);
    const latestApproved = approved.sort(compareCatalogVersionDesc)[0];

    if (!latestApproved) {
      continue;
    }

    selected.push({
      resortId: resort.resortId,
      resortName: resort.resortName,
      version: latestApproved.version,
      packUrl: latestApproved.packUrl,
      createdAt: latestApproved.createdAt,
      compatibility: latestApproved.compatibility,
      checksums: latestApproved.checksums
    });
  }

  return selected.sort((left, right) => left.resortName.localeCompare(right.resortName));
}

export async function loadPackFromCatalogEntry(entry: SelectableResortPack): Promise<ResortPack> {
  const cacheBustKey = entry.createdAt ?? entry.version;
  const packUrl = appendCacheBust(entry.packUrl, cacheBustKey);
  const response = await fetch(packUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load resort pack ${entry.resortId} (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  const result = loadResortPackFromObject(payload);
  if (result.ok) {
    return result.value;
  }

  const converted = convertExportBundleToResortPack(payload, entry.resortId);
  const convertedResult = loadResortPackFromObject(converted);
  if (!convertedResult.ok) {
    const firstError = convertedResult.errors[0] ?? result.errors[0];
    const reason = firstError ? `${firstError.path} ${firstError.message}` : "invalid Resort Pack.";
    throw new Error(`Invalid resort pack for ${entry.resortId}: ${reason}`);
  }

  return convertedResult.value;
}

function assertResortCatalog(input: unknown): ResortCatalog {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: expected object.");
  }

  if (input.schemaVersion !== "1.0.0" && input.schemaVersion !== "2.0.0") {
    throw new Error("Invalid resort catalog: unsupported schemaVersion.");
  }

  if (!Array.isArray(input.resorts)) {
    throw new Error("Invalid resort catalog: resorts must be an array.");
  }

  const schemaVersion = input.schemaVersion;
  const release = schemaVersion === "2.0.0" ? assertCatalogRelease(input.release) : undefined;
  const resorts = input.resorts.map((entry) => assertCatalogResort(entry, schemaVersion));
  return {
    schemaVersion,
    release,
    resorts
  };
}

function assertCatalogResort(input: unknown, schemaVersion: ResortCatalog["schemaVersion"]): ResortCatalogResort {
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
    versions: input.versions.map((entry) => assertCatalogVersion(entry, schemaVersion))
  };
}

function assertCatalogVersion(
  input: unknown,
  schemaVersion: ResortCatalog["schemaVersion"]
): ResortCatalogVersion {
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

  const compatibility =
    input.compatibility === undefined ? undefined : assertCatalogVersionCompatibility(input.compatibility);
  const checksums = input.checksums === undefined ? undefined : assertCatalogVersionChecksums(input.checksums);

  if (schemaVersion === "2.0.0") {
    if (!compatibility) {
      throw new Error("Invalid resort catalog: compatibility is required for schemaVersion 2.0.0.");
    }
    if (!checksums) {
      throw new Error("Invalid resort catalog: checksums are required for schemaVersion 2.0.0.");
    }
  }

  return {
    version: input.version,
    approved: input.approved,
    packUrl: input.packUrl,
    createdAt: input.createdAt,
    compatibility,
    checksums
  };
}

function assertCatalogRelease(input: unknown): ResortCatalogRelease {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: release metadata is required for schemaVersion 2.0.0.");
  }

  if (input.channel !== "stable") {
    throw new Error("Invalid resort catalog: release.channel must be 'stable'.");
  }

  if (!isValidSemverString(input.appVersion)) {
    throw new Error("Invalid resort catalog: release.appVersion must be semver.");
  }

  if (!isNonEmptyString(input.manifestUrl)) {
    throw new Error("Invalid resort catalog: release.manifestUrl is required.");
  }

  if (!isValidSha256(input.manifestSha256)) {
    throw new Error("Invalid resort catalog: release.manifestSha256 must be 64-char hex.");
  }

  if (!isNonEmptyString(input.createdAt)) {
    throw new Error("Invalid resort catalog: release.createdAt is required.");
  }

  if (input.notesSummary !== undefined && !isNonEmptyString(input.notesSummary)) {
    throw new Error("Invalid resort catalog: release.notesSummary must be string when present.");
  }

  return {
    channel: "stable",
    appVersion: input.appVersion,
    manifestUrl: input.manifestUrl,
    manifestSha256: input.manifestSha256,
    createdAt: input.createdAt,
    notesSummary: input.notesSummary
  };
}

function assertCatalogVersionCompatibility(input: unknown): ResortCatalogVersionCompatibility {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: compatibility must be object.");
  }

  if (!isValidSemverString(input.minAppVersion)) {
    throw new Error("Invalid resort catalog: compatibility.minAppVersion must be semver.");
  }

  if (input.maxAppVersion !== undefined && !isValidSemverString(input.maxAppVersion)) {
    throw new Error("Invalid resort catalog: compatibility.maxAppVersion must be semver when present.");
  }

  if (input.supportedPackSchemaVersions !== undefined) {
    if (!Array.isArray(input.supportedPackSchemaVersions)) {
      throw new Error("Invalid resort catalog: supportedPackSchemaVersions must be an array when present.");
    }

    if (!input.supportedPackSchemaVersions.every(isNonEmptyString)) {
      throw new Error("Invalid resort catalog: supportedPackSchemaVersions must contain strings.");
    }
  }

  return {
    minAppVersion: input.minAppVersion,
    maxAppVersion: input.maxAppVersion,
    supportedPackSchemaVersions: input.supportedPackSchemaVersions
  };
}

function assertCatalogVersionChecksums(input: unknown): ResortCatalogVersionChecksums {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid resort catalog: checksums must be object.");
  }

  if (!isValidSha256(input.packSha256)) {
    throw new Error("Invalid resort catalog: checksums.packSha256 must be 64-char hex.");
  }

  if (!isValidSha256(input.pmtilesSha256)) {
    throw new Error("Invalid resort catalog: checksums.pmtilesSha256 must be 64-char hex.");
  }

  if (!isValidSha256(input.styleSha256)) {
    throw new Error("Invalid resort catalog: checksums.styleSha256 must be 64-char hex.");
  }

  return {
    packSha256: input.packSha256,
    pmtilesSha256: input.pmtilesSha256,
    styleSha256: input.styleSha256
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

function isValidSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value);
}

function isValidSemverString(value: unknown): value is string {
  return typeof value === "string" && /^(\d+)\.(\d+)\.(\d+)$/u.test(value.trim());
}

export function isCatalogVersionCompatible(
  version: ResortCatalogVersion,
  args: {
    appVersion: string;
    supportedPackSchemaVersion: string;
  }
): boolean {
  const compatibility = version.compatibility;
  if (!compatibility) {
    return true;
  }

  if (compareSemver(args.appVersion, compatibility.minAppVersion) < 0) {
    return false;
  }

  if (compatibility.maxAppVersion && compareSemver(args.appVersion, compatibility.maxAppVersion) > 0) {
    return false;
  }

  const supportedSchemas = compatibility.supportedPackSchemaVersions;
  if (supportedSchemas && supportedSchemas.length > 0 && !supportedSchemas.includes(args.supportedPackSchemaVersion)) {
    return false;
  }

  return true;
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemverParts(left);
  const rightParts = parseSemverParts(right);
  if (!leftParts || !rightParts) {
    return left.localeCompare(right);
  }

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function parseSemverParts(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "", 10);
  const minor = Number.parseInt(match[2] ?? "", 10);
  const patch = Number.parseInt(match[3] ?? "", 10);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }

  return [major, minor, patch];
}

type ExportBundle = {
  export?: { resortKey?: string };
  status?: {
    query?: { name?: string; countryCode?: string };
    resortKey?: string;
  };
  layers?: {
    boundary?: unknown;
    runs?: unknown;
    lifts?: unknown;
  };
};

function convertExportBundleToResortPack(input: unknown, fallbackResortId: string): ResortPack {
  const bundle = (isObjectRecord(input) ? input : {}) as ExportBundle;
  const resortId = stringOrFallback(bundle.export?.resortKey, bundle.status?.resortKey, fallbackResortId);
  const resortName = stringOrFallback(bundle.status?.query?.name, fallbackResortId);

  const boundary = extractBoundaryPolygon(bundle.layers?.boundary);
  const runs = extractRuns(bundle.layers?.runs);
  const lifts = extractLifts(bundle.layers?.lifts);

  return {
    schemaVersion: "1.0.0",
    resort: {
      id: resortId,
      name: resortName,
      timezone: inferTimezone(bundle.status?.query?.countryCode)
    },
    boundary: boundary ?? undefined,
    basemap: {
      pmtilesPath: `packs/${resortId}/base.pmtiles`,
      stylePath: `packs/${resortId}/style.json`
    },
    thresholds: {
      liftProximityMeters: 90
    },
    lifts,
    runs
  };
}

function extractBoundaryPolygon(input: unknown): ResortPack["boundary"] | null {
  if (!isObjectRecord(input)) {
    return null;
  }

  const type = input.type;
  if (type === "Feature") {
    const geometry = isObjectRecord(input.geometry) ? input.geometry : null;
    if (!geometry) {
      return null;
    }

    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      return { type: "Polygon", coordinates: geometry.coordinates as [number, number][][] };
    }
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      const first = geometry.coordinates[0];
      if (Array.isArray(first)) {
        return { type: "Polygon", coordinates: first as [number, number][][] };
      }
    }
  }

  if (type === "FeatureCollection" && Array.isArray(input.features)) {
    for (const feature of input.features) {
      const polygon = extractBoundaryPolygon(feature);
      if (polygon) {
        return polygon;
      }
    }
  }

  return null;
}

function extractRuns(input: unknown): ResortPack["runs"] {
  if (!isObjectRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    return [];
  }

  const runs: ResortPack["runs"] = [];
  for (let index = 0; index < input.features.length; index += 1) {
    const feature = input.features[index];
    if (!isObjectRecord(feature) || !isObjectRecord(feature.geometry) || feature.geometry.type !== "LineString") {
      continue;
    }

    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      continue;
    }

    const centerline = coordinates as [number, number][];
    const properties = isObjectRecord(feature.properties) ? feature.properties : {};
    const id = stringOrFallback(properties.id, `run-${index + 1}`);
    const name = stringOrFallback(properties.name, id);
    const difficulty = mapDifficulty(properties.difficulty);
    runs.push({
      id,
      name,
      difficulty,
      centerline: {
        type: "LineString",
        coordinates: centerline
      },
      polygon: {
        type: "Polygon",
        coordinates: [buildSimpleCorridor(centerline)]
      }
    });
  }

  return runs;
}

function extractLifts(input: unknown): ResortPack["lifts"] {
  if (!isObjectRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    return [];
  }

  const lifts: ResortPack["lifts"] = [];
  for (let index = 0; index < input.features.length; index += 1) {
    const feature = input.features[index];
    if (!isObjectRecord(feature) || !isObjectRecord(feature.geometry) || feature.geometry.type !== "LineString") {
      continue;
    }

    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      continue;
    }

    const properties = isObjectRecord(feature.properties) ? feature.properties : {};
    const id = stringOrFallback(properties.id, `lift-${index + 1}`);
    const name = stringOrFallback(properties.name, id);

    lifts.push({
      id,
      name,
      towers: (coordinates as [number, number][]).map((coordinate, towerIndex) => ({
        number: towerIndex + 1,
        coordinates: coordinate
      }))
    });
  }

  return lifts;
}

function buildSimpleCorridor(centerline: [number, number][]): [number, number][] {
  const first = centerline[0];
  const last = centerline[centerline.length - 1];
  if (!first || !last) {
    return [];
  }

  const offset = 0.00008;
  return [
    [first[0] - offset, first[1] + offset],
    [last[0] - offset, last[1] + offset],
    [last[0] + offset, last[1] - offset],
    [first[0] - offset, first[1] + offset]
  ];
}

function mapDifficulty(value: unknown): ResortPack["runs"][number]["difficulty"] {
  if (typeof value !== "string") {
    return "blue";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "green" || normalized === "easy" || normalized === "novice") {
    return "green";
  }
  if (normalized === "black" || normalized === "advanced" || normalized === "expert") {
    return "black";
  }
  if (normalized === "double-black" || normalized === "double_black" || normalized === "extreme") {
    return "double-black";
  }
  return "blue";
}

function inferTimezone(countryCode: string | undefined): string {
  if (countryCode?.toUpperCase() === "CA") {
    return "America/Edmonton";
  }
  return "UTC";
}

function stringOrFallback(...values: unknown[]): string {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value;
    }
  }
  return "unknown";
}

function appendCacheBust(url: string, key: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0 || key.trim().length === 0) {
    return trimmed;
  }

  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(key)}`;
}
