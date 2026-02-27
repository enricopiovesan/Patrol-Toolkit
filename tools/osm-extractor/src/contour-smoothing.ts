type GeoJsonFeature = {
  type?: string;
  properties?: unknown;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

type GeoJsonFeatureCollection = {
  type?: string;
  features?: unknown[];
};

export type ContourSmoothingMode = "off" | "low" | "medium" | "hard" | "super-hard";

export function resolveContourSmoothingMode(env: NodeJS.ProcessEnv = process.env): ContourSmoothingMode {
  const raw = (env.PTK_CONTOUR_SMOOTHING ?? "super-hard").trim().toLowerCase();
  if (raw === "off" || raw === "low" || raw === "medium" || raw === "hard" || raw === "super-hard") {
    return raw;
  }
  throw new Error(`Invalid PTK_CONTOUR_SMOOTHING '${raw}'. Supported: off, low, medium, hard, super-hard.`);
}

export function smoothContourGeoJsonText(raw: string, mode: ContourSmoothingMode): string {
  if (mode === "off") {
    return raw;
  }
  const parsed = JSON.parse(raw) as GeoJsonFeatureCollection;
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error("Contours smoothing input must be a GeoJSON FeatureCollection.");
  }
  const iterations = mode === "super-hard" ? 4 : mode === "hard" ? 3 : mode === "medium" ? 2 : 1;
  const features = parsed.features.map((feature) => smoothContourFeature(feature, iterations));
  return `${JSON.stringify({ ...parsed, features }, null, 2)}\n`;
}

function smoothContourFeature(input: unknown, iterations: number): unknown {
  if (!isRecord(input) || !isRecord(input.geometry)) return input;
  const feature = input as GeoJsonFeature;
  const geometry = feature.geometry;
  if (!geometry) return input;
  if (geometry.type === "LineString") {
    const smoothed = smoothLineCoordinates(normalizeLine(geometry.coordinates), iterations);
    if (!smoothed) return input;
    return { ...feature, geometry: { ...geometry, coordinates: smoothed } };
  }
  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    const lines = geometry.coordinates.map((line) => {
      const normalized = normalizeLine(line);
      return normalized ? smoothLineCoordinates(normalized, iterations) : null;
    }).filter((line): line is [number, number][] => Array.isArray(line));
    return { ...feature, geometry: { ...geometry, coordinates: lines } };
  }
  return input;
}

function smoothLineCoordinates(points: [number, number][] | null, iterations: number): [number, number][] | null {
  if (!points || points.length < 3 || iterations <= 0) {
    return points;
  }
  let current = points;
  for (let i = 0; i < iterations; i += 1) {
    current = smoothLineOnce(current);
  }
  return current;
}

function smoothLineOnce(points: [number, number][]): [number, number][] {
  const closed = isClosedLine(points);
  if (closed) {
    return smoothClosedLine(points);
  }
  return smoothOpenLine(points);
}

function smoothOpenLine(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const result: [number, number][] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    result.push(weightedPoint(a, b, 0.75, 0.25), weightedPoint(a, b, 0.25, 0.75));
  }
  result.push(points[points.length - 1]!);
  return dedupeAdjacent(result);
}

function smoothClosedLine(points: [number, number][]): [number, number][] {
  const open = points.slice(0, -1);
  if (open.length < 3) return points;
  const result: [number, number][] = [];
  for (let i = 0; i < open.length; i += 1) {
    const a = open[i]!;
    const b = open[(i + 1) % open.length]!;
    result.push(weightedPoint(a, b, 0.75, 0.25), weightedPoint(a, b, 0.25, 0.75));
  }
  const deduped = dedupeAdjacent(result);
  if (deduped.length > 0) {
    deduped.push([...deduped[0]] as [number, number]);
  }
  return deduped;
}

function weightedPoint(a: [number, number], b: [number, number], aw: number, bw: number): [number, number] {
  return [
    Number((a[0] * aw + b[0] * bw).toFixed(10)),
    Number((a[1] * aw + b[1] * bw).toFixed(10))
  ];
}

function dedupeAdjacent(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
      out.push(point);
    }
  }
  return out;
}

function isClosedLine(points: [number, number][]): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return !!first && !!last && first[0] === last[0] && first[1] === last[1];
}

function normalizeLine(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const coords: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      coords.push([x, y]);
    }
  }
  return coords.length >= 2 ? coords : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
