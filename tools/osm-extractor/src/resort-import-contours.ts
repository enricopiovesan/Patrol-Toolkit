import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sha256File } from "./provenance.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";

export type ResortImportContoursResult = {
  workspacePath: string;
  outputPath: string;
  importedFeatureCount: number;
  checksumSha256: string;
  queryHash: string;
};

type GeoJsonFeatureCollection = {
  type?: string;
  features?: unknown[];
};

export async function importResortContours(args: {
  workspacePath: string;
  inputPath: string;
  outputPath?: string;
  updatedAt?: string;
}): Promise<ResortImportContoursResult> {
  const updatedAt = args.updatedAt ?? new Date().toISOString();
  const workspace = await readResortWorkspace(args.workspacePath);
  const outputPath = args.outputPath ?? join(dirname(args.workspacePath), "contours.geojson");
  const inputPath = resolve(args.inputPath);
  const raw = await readFile(inputPath, "utf8");
  const queryHash = createHash("sha256").update(raw).digest("hex");

  await writeResortWorkspace(args.workspacePath, withLayerState(workspace, "contours", { status: "running", queryHash, updatedAt, error: undefined }));

  try {
    const parsed = JSON.parse(raw) as GeoJsonFeatureCollection;
    const features = normalizeContourFeatures(parsed);
    await writeJsonFileAtomic(outputPath, { type: "FeatureCollection", features });
    const checksumSha256 = await sha256File(outputPath);
    const completed = await readResortWorkspace(args.workspacePath);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(completed, "contours", {
        status: "complete",
        artifactPath: outputPath,
        queryHash,
        featureCount: features.length,
        checksumSha256,
        updatedAt,
        error: undefined
      })
    );
    return { workspacePath: args.workspacePath, outputPath, importedFeatureCount: features.length, checksumSha256, queryHash };
  } catch (error: unknown) {
    const failed = await readResortWorkspace(args.workspacePath);
    const message = error instanceof Error ? error.message : String(error);
    await writeResortWorkspace(args.workspacePath, withLayerState(failed, "contours", { status: "failed", queryHash, updatedAt, error: message }));
    throw error;
  }
}

function normalizeContourFeatures(input: GeoJsonFeatureCollection): Array<{
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { id: string; ele: number | null };
}> {
  if (input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    throw new Error("Contours input must be a GeoJSON FeatureCollection.");
  }
  const output: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { id: string; ele: number | null };
  }> = [];
  let nextId = 1;
  for (const feature of input.features) {
    if (!isRecord(feature) || !isRecord(feature.geometry)) {
      continue;
    }
    const properties = isRecord(feature.properties) ? feature.properties : {};
    const ele = parseElevation(properties.ele ?? properties.elevationMeters ?? properties.elevation ?? properties.contour);
    if (feature.geometry.type === "LineString") {
      const coords = normalizeLineCoordinates(feature.geometry.coordinates);
      if (!coords) {
        continue;
      }
      output.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { id: stringOrFallback(properties.id, `contour-${nextId++}`), ele }
      });
      continue;
    }
    if (feature.geometry.type === "MultiLineString" && Array.isArray(feature.geometry.coordinates)) {
      for (const lineCoords of feature.geometry.coordinates) {
        const coords = normalizeLineCoordinates(lineCoords);
        if (!coords) {
          continue;
        }
        output.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: { id: `contour-${nextId++}`, ele }
        });
      }
    }
  }
  return output;
}

function normalizeLineCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const coords: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) {
      continue;
    }
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coords.push([lon, lat]);
    }
  }
  return coords.length >= 2 ? coords : null;
}

function parseElevation(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = /(-?\d+(?:\.\d+)?)/u.exec(value);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOrFallback(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "unknown";
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, path);
}

