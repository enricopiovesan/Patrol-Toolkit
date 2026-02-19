import { readResortWorkspace } from "./resort-workspace.js";
import { searchResortCandidates, type ResortSearchCandidate, type ResortSearchResult } from "./resort-search.js";
import { defaultCacheDir, resilientFetchJson } from "./network-resilience.js";

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type LookupRecord = {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  geojson?: GeoJsonPolygon | GeoJsonMultiPolygon | Record<string, unknown>;
};

export type ResortBoundaryCandidate = {
  osmType: "relation" | "way" | "node";
  osmId: number;
  displayName: string;
  center: [number, number];
  source: "selection" | "search";
  geometryType: "Polygon" | "MultiPolygon" | null;
  ring: [number, number][] | null;
  validation: {
    containsSelectionCenter: boolean;
    ringClosed: boolean;
    areaKm2: number | null;
    score: number;
    issues: string[];
  };
};

export type ResortBoundaryDetectionResult = {
  workspacePath: string;
  candidates: ResortBoundaryCandidate[];
};

export function buildNominatimLookupUrl(candidate: { osmType: "relation" | "way" | "node"; osmId: number }): string {
  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  const prefix = candidate.osmType === "relation" ? "R" : candidate.osmType === "way" ? "W" : "N";
  url.searchParams.set("osm_ids", `${prefix}${candidate.osmId}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "1");
  return url.toString();
}

export async function detectResortBoundaryCandidates(
  args: {
    workspacePath: string;
    searchLimit: number;
  },
  deps?: {
    fetchFn?: typeof fetch;
    searchFn?: (query: { name: string; country: string; limit: number }) => Promise<ResortSearchResult>;
    userAgent?: string;
  }
): Promise<ResortBoundaryDetectionResult> {
  const workspace = await readResortWorkspace(args.workspacePath);
  const selection = workspace.resort.selection;
  if (!selection) {
    throw new Error("Workspace has no selected resort. Run resort-select first.");
  }
  const fetchFn = deps?.fetchFn ?? fetch;
  const searchFn = deps?.searchFn ?? searchResortCandidates;
  const userAgent = deps?.userAgent ?? "patrol-toolkit-osm-extractor/0.1";
  const throttleMs = deps?.fetchFn ? 0 : 1100;

  const fallbackSearch = await searchFn({
    name: workspace.resort.query.name,
    country: workspace.resort.query.country,
    limit: args.searchLimit
  });

  const seedCandidates: Array<{ source: "selection" | "search"; candidate: ResortSearchCandidate }> = [
    {
      source: "selection",
      candidate: {
        osmType: selection.osmType,
        osmId: selection.osmId,
        displayName: selection.displayName,
        center: selection.center,
        countryCode: null,
        country: null,
        region: null,
        importance: null,
        source: "nominatim"
      }
    }
  ];

  for (const candidate of fallbackSearch.candidates) {
    if (candidate.osmType === selection.osmType && candidate.osmId === selection.osmId) {
      continue;
    }
    seedCandidates.push({ source: "search", candidate });
  }

  const seen = new Set<string>();
  const resolved: ResortBoundaryCandidate[] = [];
  for (const seed of seedCandidates) {
    const key = `${seed.candidate.osmType}:${seed.candidate.osmId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const lookup = await lookupBoundary(seed.candidate, {
      fetchFn,
      userAgent,
      throttleMs
    });
    resolved.push(
      scoreBoundaryCandidate({
        source: seed.source,
        candidate: seed.candidate,
        lookup,
        selectionCenter: selection.center,
        queryName: workspace.resort.query.name
      })
    );
  }

  return {
    workspacePath: args.workspacePath,
    candidates: resolved.sort((left, right) => {
      if (left.validation.score !== right.validation.score) {
        return right.validation.score - left.validation.score;
      }
      return left.displayName.localeCompare(right.displayName);
    })
  };
}

async function lookupBoundary(
  candidate: ResortSearchCandidate,
  deps: {
    fetchFn: typeof fetch;
    userAgent: string;
    throttleMs: number;
  }
): Promise<LookupRecord | null> {
  const url = buildNominatimLookupUrl(candidate);
  const raw = await resilientFetchJson({
    url,
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": deps.userAgent
    },
    fetchFn: deps.fetchFn,
    throttleMs: deps.throttleMs,
    cache: {
      dir: defaultCacheDir(),
      ttlMs: 60 * 60 * 1000,
      key: `boundary-lookup:${candidate.osmType}:${candidate.osmId}:${url}`
    }
  }).catch(() => null);
  if (raw === null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const first = raw[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  return first as LookupRecord;
}

function scoreBoundaryCandidate(args: {
  source: "selection" | "search";
  candidate: ResortSearchCandidate;
  lookup: LookupRecord | null;
  selectionCenter: [number, number];
  queryName: string;
}): ResortBoundaryCandidate {
  const displayName = args.lookup?.display_name?.trim() || args.candidate.displayName;
  const center: [number, number] = toCenter(args.lookup) ?? args.candidate.center;
  const { geometryType, ring } = extractRing(args.lookup?.geojson);

  const issues: string[] = [];
  const ringClosed = ring ? isRingClosed(ring) : false;
  const areaKm2 = ring ? Math.abs(approximateRingAreaKm2(ring)) : null;
  const containsSelectionCenter = ring ? pointInPolygon(args.selectionCenter, ring) : false;

  let score = 0;
  if (ring) {
    score += 40;
  } else {
    issues.push("No polygon geometry available from lookup.");
  }
  if (ring && ringClosed) {
    score += 20;
  } else if (ring) {
    issues.push("Boundary ring is not closed.");
  }
  if (containsSelectionCenter) {
    score += 30;
  } else {
    issues.push("Selection center is outside candidate boundary.");
  }
  if (areaKm2 !== null && areaKm2 >= 0.1 && areaKm2 <= 1000) {
    score += 20;
  } else if (areaKm2 !== null) {
    issues.push("Boundary area is outside expected ski resort range (0.1-1000 km2).");
  }
  if (displayName.toLowerCase().includes(args.queryName.toLowerCase())) {
    score += 10;
  }

  return {
    osmType: args.candidate.osmType,
    osmId: args.candidate.osmId,
    displayName,
    center,
    source: args.source,
    geometryType,
    ring,
    validation: {
      containsSelectionCenter,
      ringClosed,
      areaKm2,
      score,
      issues
    }
  };
}

function toCenter(record: LookupRecord | null | undefined): [number, number] | null {
  const lat = Number(record?.lat);
  const lon = Number(record?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return [lon, lat];
}

function extractRing(geojson: LookupRecord["geojson"] | undefined): {
  geometryType: "Polygon" | "MultiPolygon" | null;
  ring: [number, number][] | null;
} {
  if (isGeoJsonPolygon(geojson)) {
    const ring = geojson.coordinates[0];
    if (!ring) {
      return { geometryType: "Polygon", ring: null };
    }
    return { geometryType: "Polygon", ring: toLngLatRing(ring) };
  }

  if (isGeoJsonMultiPolygon(geojson)) {
    const largest = geojson.coordinates
      .map((polygon) => polygon[0])
      .filter((ring): ring is number[][] => Array.isArray(ring))
      .map((ring) => toLngLatRing(ring))
      .sort((left, right) => Math.abs(approximateRingAreaKm2(right)) - Math.abs(approximateRingAreaKm2(left)))[0];
    return { geometryType: "MultiPolygon", ring: largest ?? null };
  }

  return { geometryType: null, ring: null };
}

function isGeoJsonPolygon(value: unknown): value is GeoJsonPolygon {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<GeoJsonPolygon>;
  return candidate.type === "Polygon" && Array.isArray(candidate.coordinates);
}

function isGeoJsonMultiPolygon(value: unknown): value is GeoJsonMultiPolygon {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<GeoJsonMultiPolygon>;
  return candidate.type === "MultiPolygon" && Array.isArray(candidate.coordinates);
}

function toLngLatRing(ring: number[][]): [number, number][] {
  const points: [number, number][] = [];
  for (const point of ring) {
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      points.push([lon, lat]);
    }
  }
  return points;
}

function isRingClosed(ring: [number, number][]): boolean {
  if (ring.length < 4) {
    return false;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) {
    return false;
  }
  return first[0] === last[0] && first[1] === last[1];
}

function approximateRingAreaKm2(ring: [number, number][]): number {
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

    // Equirectangular approximation for ranking/validation only.
    const x1 = current[0] * 111.32 * Math.cos((current[1] * Math.PI) / 180);
    const y1 = current[1] * 110.57;
    const x2 = next[0] * 111.32 * Math.cos((next[1] * Math.PI) / 180);
    const y2 = next[1] * 110.57;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!pi || !pj) {
      continue;
    }
    const intersects =
      pi[1] > point[1] !== pj[1] > point[1] &&
      point[0] < ((pj[0] - pi[0]) * (point[1] - pi[1])) / (pj[1] - pi[1] || Number.EPSILON) + pi[0];
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}
