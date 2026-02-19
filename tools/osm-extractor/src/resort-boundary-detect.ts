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

type OverpassWinterSportsElement = {
  type?: "way" | "relation" | "node";
  id?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lon?: number; lat?: number }>;
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
    distanceToSelectionCenterKm: number;
    score: number;
    signals: string[];
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

export function buildWinterSportsOverpassQuery(args: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  timeoutSeconds: number;
}): string {
  return `[out:json][timeout:${args.timeoutSeconds}];
(
  way["landuse"="winter_sports"](${args.minLat},${args.minLon},${args.maxLat},${args.maxLon});
  relation["landuse"="winter_sports"](${args.minLat},${args.minLon},${args.maxLat},${args.maxLon});
);
out geom tags;`;
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

  const winterSportsCandidates = await fetchWinterSportsBoundaryCandidates({
    selectionCenter: selection.center,
    queryName: workspace.resort.query.name,
    fetchFn,
    userAgent,
    throttleMs
  });
  for (const candidate of winterSportsCandidates) {
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

async function fetchWinterSportsBoundaryCandidates(args: {
  selectionCenter: [number, number];
  queryName: string;
  fetchFn: typeof fetch;
  userAgent: string;
  throttleMs: number;
}): Promise<ResortSearchCandidate[]> {
  const bbox = computeCenterBbox(args.selectionCenter, 25_000);
  const query = buildWinterSportsOverpassQuery({
    minLon: bbox.minLon,
    minLat: bbox.minLat,
    maxLon: bbox.maxLon,
    maxLat: bbox.maxLat,
    timeoutSeconds: 30
  });

  const raw = (await resilientFetchJson({
    url: "https://overpass-api.de/api/interpreter",
    method: "POST",
    headers: {
      "content-type": "text/plain",
      accept: "application/json",
      "user-agent": args.userAgent
    },
    body: query,
    fetchFn: args.fetchFn,
    throttleMs: args.throttleMs,
    cache: {
      dir: defaultCacheDir(),
      ttlMs: 60 * 60 * 1000,
      key: `winter-sports-boundary:${query}`
    }
  }).catch(() => null)) as { elements?: OverpassWinterSportsElement[] } | null;
  if (!raw || !Array.isArray(raw.elements)) {
    return [];
  }

  const candidates: ResortSearchCandidate[] = [];
  for (const element of raw.elements) {
    const elementId = element.id;
    if ((element.type !== "way" && element.type !== "relation") || typeof elementId !== "number" || !Number.isInteger(elementId)) {
      continue;
    }

    const ring = overpassGeometryToRing(element.geometry);
    if (!ring || ring.length < 4) {
      continue;
    }
    const center = computeRingCenter(ring);
    const displayName =
      element.tags?.name?.trim() ||
      element.tags?.["name:en"]?.trim() ||
      `${args.queryName} winter sports area ${element.type}/${String(element.id)}`;

    candidates.push({
      osmType: element.type,
      osmId: elementId,
      displayName,
      center,
      countryCode: null,
      country: null,
      region: null,
      importance: 1,
      source: "nominatim"
    });
  }

  return candidates;
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
  const signals: string[] = [];
  const ringClosed = ring ? isRingClosed(ring) : false;
  const areaKm2 = ring ? Math.abs(approximateRingAreaKm2(ring)) : null;
  const containsSelectionCenter = ring ? pointInPolygon(args.selectionCenter, ring) : false;
  const distanceToSelectionCenterKm = haversineDistanceKm(args.selectionCenter, center);

  let score = 0;
  if (ring) {
    score += 40;
    signals.push("has-polygon");
  } else {
    issues.push("No polygon geometry available from lookup.");
  }
  if (ring && ringClosed) {
    score += 20;
    signals.push("ring-closed");
  } else if (ring) {
    issues.push("Boundary ring is not closed.");
  }
  if (containsSelectionCenter) {
    score += 30;
    signals.push("contains-selection-center");
  } else {
    issues.push("Selection center is outside candidate boundary.");
  }
  if (areaKm2 !== null && areaKm2 >= 0.1 && areaKm2 <= 1000) {
    score += 20;
    signals.push("area-in-range");
  } else if (areaKm2 !== null) {
    issues.push("Boundary area is outside expected ski resort range (0.1-1000 km2).");
  }
  const displayNameLower = displayName.toLowerCase();
  const queryLower = args.queryName.toLowerCase();
  if (displayNameLower.includes(queryLower)) {
    score += 10;
    signals.push("name-matches-query");
  }
  if (displayNameLower.includes("winter sports")) {
    score += 20;
    signals.push("winter-sports-name");
  }
  if (args.source === "selection") {
    score += 6;
    signals.push("from-current-selection");
  }
  if (args.candidate.osmType === "relation") {
    score += 6;
    signals.push("relation-geometry");
  } else if (args.candidate.osmType === "way") {
    score += 3;
    signals.push("way-geometry");
  }
  if (distanceToSelectionCenterKm <= 2) {
    score += 15;
    signals.push("very-close-center");
  } else if (distanceToSelectionCenterKm <= 10) {
    score += 8;
    signals.push("close-center");
  } else if (distanceToSelectionCenterKm <= 25) {
    score += 2;
    signals.push("nearby-center");
  } else {
    issues.push("Candidate center is far from selected resort center (>25 km).");
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
      distanceToSelectionCenterKm,
      score,
      signals,
      issues
    }
  };
}

function haversineDistanceKm(from: [number, number], to: [number, number]): number {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function overpassGeometryToRing(geometry: Array<{ lon?: number; lat?: number }> | undefined): [number, number][] | null {
  if (!geometry || geometry.length < 4) {
    return null;
  }
  const ring = geometry
    .map((point) => [Number(point.lon), Number(point.lat)] as [number, number])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (ring.length < 4) {
    return null;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function computeRingCenter(ring: [number, number][]): [number, number] {
  let lonSum = 0;
  let latSum = 0;
  let count = 0;
  for (const [lon, lat] of ring) {
    lonSum += lon;
    latSum += lat;
    count += 1;
  }
  if (count === 0) {
    return [0, 0];
  }
  return [lonSum / count, latSum / count];
}

function computeCenterBbox(
  center: [number, number],
  radiusMeters: number
): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const [lon, lat] = center;
  const latBuffer = radiusMeters / 110_574;
  const lonBuffer = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    minLon: lon - lonBuffer,
    minLat: lat - latBuffer,
    maxLon: lon + lonBuffer,
    maxLat: lat + latBuffer
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
