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
