import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256File } from "./provenance.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";
import { resilientFetchJson } from "./network-resilience.js";

type OverpassElement = {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat?: number; lon?: number }>;
};

type BoundaryFeature = {
  type: "Feature";
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

export type ResortSyncLiftsResult = {
  workspacePath: string;
  outputPath: string;
  queryHash: string;
  liftCount: number;
  checksumSha256: string;
};

export function buildLiftsOverpassQuery(args: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  timeoutSeconds: number;
}): string {
  return `[out:json][timeout:${args.timeoutSeconds}];
(
  way["aerialway"](${args.minLat},${args.minLon},${args.maxLat},${args.maxLon});
  relation["aerialway"](${args.minLat},${args.minLon},${args.maxLat},${args.maxLon});
);
out geom tags;`;
}

export async function syncResortLifts(
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
): Promise<ResortSyncLiftsResult> {
  const fetchFn = deps?.fetchFn ?? fetch;
  const updatedAt = args.updatedAt ?? new Date().toISOString();
  const workspace = await readResortWorkspace(args.workspacePath);

  const boundaryPath = workspace.layers.boundary.artifactPath;
  if (workspace.layers.boundary.status !== "complete" || !boundaryPath) {
    throw new Error("Boundary layer is not complete. Run resort-boundary-set first.");
  }
  const ring = await readBoundaryRing(boundaryPath);
  const bbox = computeBufferedBbox(ring, args.bufferMeters ?? 0);
  const query = buildLiftsOverpassQuery({
    minLon: bbox.minLon,
    minLat: bbox.minLat,
    maxLon: bbox.maxLon,
    maxLat: bbox.maxLat,
    timeoutSeconds: args.timeoutSeconds ?? 30
  });
  const queryHash = createHash("sha256").update(query).digest("hex");
  const outputPath = args.outputPath ?? join(dirname(args.workspacePath), "lifts.geojson");

  await writeResortWorkspace(
    args.workspacePath,
    withLayerState(workspace, "lifts", {
      status: "running",
      queryHash,
      updatedAt,
      error: undefined
    })
  );

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
        key: `lifts:${queryHash}`
      }
    })) as { elements?: OverpassElement[] };

    const features = toLiftFeatures(raw.elements ?? []);
    await writeJsonFileAtomic(outputPath, {
      type: "FeatureCollection",
      features
    });
    const checksumSha256 = await sha256File(outputPath);
    const completedWorkspace = await readResortWorkspace(args.workspacePath);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(completedWorkspace, "lifts", {
        status: "complete",
        artifactPath: outputPath,
        queryHash,
        featureCount: features.length,
        checksumSha256,
        updatedAt,
        error: undefined
      })
    );

    return {
      workspacePath: args.workspacePath,
      outputPath,
      queryHash,
      liftCount: features.length,
      checksumSha256
    };
  } catch (error: unknown) {
    const failedWorkspace = await readResortWorkspace(args.workspacePath);
    const message = error instanceof Error ? error.message : String(error);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(failedWorkspace, "lifts", {
        status: "failed",
        queryHash,
        updatedAt,
        error: message
      })
    );
    throw error;
  }
}

function withLayerState(
  workspace: ResortWorkspace,
  layer: "boundary" | "lifts" | "runs",
  state: ResortWorkspace["layers"]["boundary"]
): ResortWorkspace {
  return {
    ...workspace,
    layers: {
      ...workspace.layers,
      [layer]: {
        ...workspace.layers[layer],
        ...state
      }
    }
  };
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
  return {
    minLon: minLon - lonBuffer,
    minLat: minLat - latBuffer,
    maxLon: maxLon + lonBuffer,
    maxLat: maxLat + latBuffer
  };
}

function toLiftFeatures(elements: OverpassElement[]): Array<{
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { id: string; name: string; aerialway: string };
}> {
  return elements
    .filter((element) => element.type === "way")
    .map((element) => {
      const aerialway = element.tags?.aerialway?.trim();
      if (!aerialway) {
        return null;
      }

      const coordinates =
        element.geometry
          ?.map((point) => [Number(point.lon), Number(point.lat)] as [number, number])
          .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)) ?? [];
      if (coordinates.length < 2) {
        return null;
      }

      return {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates
        },
        properties: {
          id: `way/${String(element.id ?? "unknown")}`,
          name: element.tags?.name?.trim() || `Lift ${String(element.id ?? "unknown")}`,
          aerialway
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}
