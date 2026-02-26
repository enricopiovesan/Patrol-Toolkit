import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sha256File } from "./provenance.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";

export type ResortImportTerrainBandsResult = {
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

export async function importResortTerrainBands(args: {
  workspacePath: string;
  inputPath: string;
  outputPath?: string;
  updatedAt?: string;
}): Promise<ResortImportTerrainBandsResult> {
  const updatedAt = args.updatedAt ?? new Date().toISOString();
  const workspace = await readResortWorkspace(args.workspacePath);
  const outputPath = args.outputPath ?? join(dirname(args.workspacePath), "terrain-bands.geojson");
  const inputPath = resolve(args.inputPath);
  const raw = await readFile(inputPath, "utf8");
  const queryHash = createHash("sha256").update(raw).digest("hex");

  await writeResortWorkspace(
    args.workspacePath,
    withLayerState(workspace, "terrainBands", { status: "running", queryHash, updatedAt, error: undefined })
  );

  try {
    const parsed = JSON.parse(raw) as GeoJsonFeatureCollection;
    const features = normalizeTerrainBandFeatures(parsed);
    await writeJsonFileAtomic(outputPath, { type: "FeatureCollection", features });
    const checksumSha256 = await sha256File(outputPath);
    const completed = await readResortWorkspace(args.workspacePath);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(completed, "terrainBands", {
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
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(failed, "terrainBands", { status: "failed", queryHash, updatedAt, error: message })
    );
    throw error;
  }
}

function normalizeTerrainBandFeatures(input: GeoJsonFeatureCollection): Array<{
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: { id: string; eleMin: number | null; eleMax: number | null };
}> {
  if (input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    throw new Error("Terrain bands input must be a GeoJSON FeatureCollection.");
  }
  const output: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
    properties: { id: string; eleMin: number | null; eleMax: number | null };
  }> = [];
  let nextId = 1;

  for (const feature of input.features) {
    if (!isRecord(feature) || !isRecord(feature.geometry)) continue;
    const properties = isRecord(feature.properties) ? feature.properties : {};
    const eleMin = parseElevation(properties.eleMin ?? properties.elevationMinMeters ?? properties.min_elev ?? properties.amin);
    const eleMax = parseElevation(properties.eleMax ?? properties.elevationMaxMeters ?? properties.max_elev ?? properties.amax);

    if (feature.geometry.type === "Polygon") {
      const coords = normalizePolygonCoordinates(feature.geometry.coordinates);
      if (!coords) continue;
      output.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: coords },
        properties: { id: stringOrFallback(properties.id, `terrain-band-${nextId++}`), eleMin, eleMax }
      });
      continue;
    }

    if (feature.geometry.type === "MultiPolygon" && Array.isArray(feature.geometry.coordinates)) {
      for (const polygonCoords of feature.geometry.coordinates) {
        const coords = normalizePolygonCoordinates(polygonCoords);
        if (!coords) continue;
        output.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: coords },
          properties: { id: `terrain-band-${nextId++}`, eleMin, eleMax }
        });
      }
    }
  }

  return output;
}

function normalizePolygonCoordinates(value: unknown): [number, number][][] | null {
  if (!Array.isArray(value) || value.length < 1) return null;
  const rings: [number, number][][] = [];
  for (const ringValue of value) {
    if (!Array.isArray(ringValue) || ringValue.length < 4) continue;
    const ring: [number, number][] = [];
    for (const point of ringValue) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        ring.push([lon, lat]);
      }
    }
    if (ring.length >= 4) {
      rings.push(ring);
    }
  }
  return rings.length > 0 ? rings : null;
}

function parseElevation(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = /(-?\d+(?:\.\d+)?)/u.exec(value);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function withLayerState(
  workspace: ResortWorkspace,
  layer: "boundary" | "lifts" | "runs" | "peaks" | "contours" | "terrainBands",
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
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "unknown";
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, path);
}

