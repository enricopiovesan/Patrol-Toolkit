import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resilientFetchJson } from "./network-resilience.js";
import { sha256File } from "./provenance.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

type BoundaryFeature = {
  type: "Feature";
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

export type ResortSyncPeaksResult = {
  workspacePath: string;
  outputPath: string;
  queryHash: string;
  peakCount: number;
  checksumSha256: string;
};

export function buildPeaksOverpassQuery(args: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  timeoutSeconds: number;
}): string {
  return `[out:json][timeout:${args.timeoutSeconds}];
(
  node["natural"="peak"](${args.minLat},${args.minLon},${args.maxLat},${args.maxLon});
);
out tags;`;
}

export async function syncResortPeaks(
  args: {
    workspacePath: string;
    outputPath?: string;
    bufferMeters?: number;
    timeoutSeconds?: number;
    updatedAt?: string;
  },
  deps?: {
    fetchFn?: typeof fetch;
  }
): Promise<ResortSyncPeaksResult> {
  const fetchFn = deps?.fetchFn ?? fetch;
  const updatedAt = args.updatedAt ?? new Date().toISOString();
  const workspace = await readResortWorkspace(args.workspacePath);
  const boundaryPath = workspace.layers.boundary.artifactPath;
  if (workspace.layers.boundary.status !== "complete" || !boundaryPath) {
    throw new Error("Boundary layer is not complete. Run resort-boundary-set first.");
  }
  const ring = await readBoundaryRing(boundaryPath);
  const bbox = computeBufferedBbox(ring, args.bufferMeters ?? 500);
  const query = buildPeaksOverpassQuery({
    minLon: bbox.minLon,
    minLat: bbox.minLat,
    maxLon: bbox.maxLon,
    maxLat: bbox.maxLat,
    timeoutSeconds: args.timeoutSeconds ?? 30
  });
  const queryHash = createHash("sha256").update(query).digest("hex");
  const outputPath = args.outputPath ?? join(dirname(args.workspacePath), "peaks.geojson");

  await writeResortWorkspace(args.workspacePath, withLayerState(workspace, "peaks", { status: "running", queryHash, updatedAt, error: undefined }));

  try {
    const raw = (await resilientFetchJson({
      url: "https://overpass-api.de/api/interpreter",
      method: "POST",
      headers: {
        "content-type": "text/plain",
        accept: "application/json",
        "user-agent": "patrol-toolkit-osm-extractor/0.1"
      },
      body: query,
      fetchFn,
      throttleMs: deps?.fetchFn ? 0 : 1100,
      cache: {
        dir: join(dirname(args.workspacePath), ".cache"),
        ttlMs: 60 * 60 * 1000,
        key: `peaks:${queryHash}`
      }
    })) as { elements?: OverpassElement[] };

    const features = toPeakFeatures(raw.elements ?? []);
    await writeJsonFileAtomic(outputPath, { type: "FeatureCollection", features });
    const checksumSha256 = await sha256File(outputPath);
    const completed = await readResortWorkspace(args.workspacePath);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(completed, "peaks", {
        status: "complete",
        artifactPath: outputPath,
        queryHash,
        featureCount: features.length,
        checksumSha256,
        updatedAt,
        error: undefined
      })
    );

    return { workspacePath: args.workspacePath, outputPath, queryHash, peakCount: features.length, checksumSha256 };
  } catch (error: unknown) {
    const failed = await readResortWorkspace(args.workspacePath);
    const message = error instanceof Error ? error.message : String(error);
    await writeResortWorkspace(args.workspacePath, withLayerState(failed, "peaks", { status: "failed", queryHash, updatedAt, error: message }));
    throw error;
  }
}

function withLayerState(
  workspace: ResortWorkspace,
  layer: "boundary" | "lifts" | "runs" | "peaks" | "contours",
  state: ResortWorkspace["layers"]["boundary"]
): ResortWorkspace {
  const current = workspace.layers[layer] ?? { status: "pending" as const };
  return {
    ...workspace,
    layers: {
      ...workspace.layers,
      [layer]: {
        ...current,
        ...state
      }
    }
  };
}

function toPeakFeatures(elements: OverpassElement[]): Array<{
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id: string; name: string; ele: number | null };
}> {
  return elements
    .filter((element) => element.type === "node")
    .map((element) => {
      const lon = Number(element.lon);
      const lat = Number(element.lat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return null;
      }
      const natural = element.tags?.natural?.trim();
      if (natural !== "peak") {
        return null;
      }
      const ele = parseElevationMeters(element.tags?.ele);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [lon, lat] as [number, number] },
        properties: {
          id: `node/${String(element.id ?? "unknown")}`,
          name: element.tags?.name?.trim() || `Peak ${String(element.id ?? "unknown")}`,
          ele
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);
}

function parseElevationMeters(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /(-?\d+(?:\.\d+)?)/u.exec(value);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

async function readBoundaryRing(path: string): Promise<[number, number][]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as BoundaryFeature;
  if (parsed.type !== "Feature" || parsed.geometry?.type !== "Polygon") {
    throw new Error("Boundary artifact is not a Polygon feature.");
  }
  const coordinates = parsed.geometry.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error("Boundary polygon coordinates are missing.");
  }
  const ring = coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error("Boundary polygon ring is missing or invalid.");
  }
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

function computeBufferedBbox(
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
  return { minLon: minLon - lonBuffer, minLat: minLat - latBuffer, maxLon: maxLon + lonBuffer, maxLat: maxLat + latBuffer };
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, path);
}
