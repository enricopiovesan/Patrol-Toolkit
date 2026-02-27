import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { importResortContours } from "./resort-import-contours.js";
import { importResortTerrainBands } from "./resort-import-terrain-bands.js";
import { resolveContourSmoothingMode, smoothContourGeoJsonText, type ContourSmoothingMode } from "./contour-smoothing.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";

type BoundaryFeature = {
  type: "Feature";
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

export type ResortSyncContoursResult = {
  workspacePath: string;
  outputPath: string;
  importedFeatureCount: number;
  importedTerrainBandCount: number;
  checksumSha256: string;
  queryHash: string;
  provider: "opentopography";
  demUrl: string;
  contourIntervalMeters: number;
  bufferMeters: number;
};

export type ContourProviderConfig = {
  provider: "opentopography";
  apiKey: string;
  dataset: string;
  baseUrl: string;
  userAgent: string;
  gdalContourBin: string;
  contourSmoothingMode: ContourSmoothingMode;
};

const execFileAsync = promisify(execFileCb);

export function resolveContourProviderConfig(env: NodeJS.ProcessEnv = process.env): ContourProviderConfig {
  const provider = (env.PTK_CONTOUR_DEM_PROVIDER ?? "opentopography").trim().toLowerCase();
  if (provider !== "opentopography") {
    throw new Error(`Unsupported contour DEM provider '${provider}'. Supported: opentopography.`);
  }
  const apiKey = (env.PTK_OPENTOPO_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("PTK_OPENTOPO_API_KEY is required for automated contour generation.");
  }
  return {
    provider: "opentopography",
    apiKey,
    dataset: (env.PTK_OPENTOPO_DATASET ?? "COP30").trim() || "COP30",
    baseUrl:
      (env.PTK_OPENTOPO_GLOBALDEM_URL ?? "https://portal.opentopography.org/API/globaldem").trim() ||
      "https://portal.opentopography.org/API/globaldem",
    userAgent: (env.PTK_CONTOUR_USER_AGENT ?? "patrol-toolkit-osm-extractor/0.1").trim() ||
      "patrol-toolkit-osm-extractor/0.1",
    gdalContourBin: (env.PTK_GDAL_CONTOUR_BIN ?? "gdal_contour").trim() || "gdal_contour",
    contourSmoothingMode: resolveContourSmoothingMode(env)
  };
}

function looksLikeSpawnENOENT(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeErr = error as { code?: unknown; message?: unknown };
  if (maybeErr.code === "ENOENT") return true;
  const message = typeof maybeErr.message === "string" ? maybeErr.message : "";
  return message.includes("ENOENT") && message.includes("gdal_contour");
}

async function tryResolveQgisGdalContourBin(): Promise<string | null> {
  if (process.platform !== "darwin") return null;

  // QGIS bundles GDAL tools at: /Applications/QGIS*.app/Contents/MacOS/gdal_contour
  // Some users have nightly builds like: /Applications/QGIS-master-<hash>.app/Contents/MacOS/gdal_contour
  const applicationsDir = "/Applications";
  let entries: string[] = [];
  try {
    entries = await readdir(applicationsDir);
  } catch {
    return null;
  }

  const candidates = entries
    .filter((name) => name.startsWith("QGIS") && name.endsWith(".app"))
    .map((name) => join(applicationsDir, name, "Contents", "MacOS", "gdal_contour"));

  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

export function buildOpenTopographyGlobalDemUrl(args: {
  baseUrl: string;
  apiKey: string;
  dataset: string;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}): string {
  const url = new URL(args.baseUrl);
  url.searchParams.set("demtype", args.dataset);
  url.searchParams.set("south", String(args.minLat));
  url.searchParams.set("north", String(args.maxLat));
  url.searchParams.set("west", String(args.minLon));
  url.searchParams.set("east", String(args.maxLon));
  url.searchParams.set("outputFormat", "GTiff");
  url.searchParams.set("API_Key", args.apiKey);
  return url.toString();
}

export async function syncResortContours(
  args: {
    workspacePath: string;
    outputPath?: string;
    bufferMeters?: number;
    contourIntervalMeters?: number;
    updatedAt?: string;
  },
  deps?: {
    fetchFn?: typeof fetch;
    execFileFn?: (file: string, args: string[]) => Promise<void>;
    importContoursFn?: typeof importResortContours;
    importTerrainBandsFn?: typeof importResortTerrainBands;
    env?: NodeJS.ProcessEnv;
    tmpRoot?: string;
    resolveQgisGdalContourBinFn?: () => Promise<string | null>;
  }
): Promise<ResortSyncContoursResult> {
  const fetchFn = deps?.fetchFn ?? fetch;
  const execFileFn = deps?.execFileFn ?? (async (file, fileArgs) => {
    await execFileAsync(file, fileArgs);
  });
  const importContoursFn = deps?.importContoursFn ?? importResortContours;
  const importTerrainBandsFn = deps?.importTerrainBandsFn ?? importResortTerrainBands;
  const env = deps?.env ?? process.env;
  const resolveQgisGdalContourBinFn = deps?.resolveQgisGdalContourBinFn ?? tryResolveQgisGdalContourBin;
  const provider = resolveContourProviderConfig(env);
  const updatedAt = args.updatedAt ?? new Date().toISOString();
  const bufferMeters = args.bufferMeters ?? 2000;
  const contourIntervalMeters = args.contourIntervalMeters ?? 20;
  if (!Number.isFinite(bufferMeters) || bufferMeters < 0) {
    throw new Error("Contour bufferMeters must be a number >= 0.");
  }
  if (!Number.isFinite(contourIntervalMeters) || contourIntervalMeters <= 0) {
    throw new Error("Contour interval must be a number > 0.");
  }

  const workspace = await readResortWorkspace(args.workspacePath);
  const boundaryPath = workspace.layers.boundary.artifactPath;
  if (workspace.layers.boundary.status !== "complete" || !boundaryPath) {
    throw new Error("Boundary layer is not complete. Run resort-boundary-set first.");
  }
  const ring = await readBoundaryRing(boundaryPath);
  const bbox = computeBufferedBbox(ring, bufferMeters);
  const demUrl = buildOpenTopographyGlobalDemUrl({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    dataset: provider.dataset,
    minLon: bbox.minLon,
    minLat: bbox.minLat,
    maxLon: bbox.maxLon,
    maxLat: bbox.maxLat
  });
  const queryHash = createHash("sha256").update(JSON.stringify({ demUrl, contourIntervalMeters })).digest("hex");

  await writeResortWorkspace(
    args.workspacePath,
    withLayerState(workspace, "contours", { status: "running", queryHash, updatedAt, error: undefined })
  );

  const tmpBase = deps?.tmpRoot ?? tmpdir();
  const workDir = await mkdtemp(join(tmpBase, "ptk-contours-"));
  const demPath = join(workDir, "dem.tif");
  const generatedContoursPath = join(workDir, "contours.generated.geojson");
  const generatedTerrainBandsPath = join(workDir, "terrain-bands.generated.geojson");

  try {
    const response = await fetchFn(demUrl, {
      headers: {
        accept: "application/octet-stream,*/*",
        "user-agent": provider.userAgent
      }
    });
    if (!response.ok) {
      throw new Error(`DEM download failed (${response.status} ${response.statusText})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error("DEM download returned an empty response.");
    }
    await writeFile(demPath, bytes);

    const contourArgs = [
      "-a",
      "ele",
      "-i",
      String(contourIntervalMeters),
      "-f",
      "GeoJSON",
      demPath,
      generatedContoursPath
    ];

    try {
      await execFileFn(provider.gdalContourBin, contourArgs);
    } catch (error: unknown) {
      // If the user doesn't have Homebrew/conda and `gdal_contour` isn't on PATH, try QGIS-bundled binary on macOS.
      if (!env.PTK_GDAL_CONTOUR_BIN && looksLikeSpawnENOENT(error)) {
        const qgisBin = await resolveQgisGdalContourBinFn();
        if (qgisBin) {
          await execFileFn(qgisBin, contourArgs);
        } else {
          throw new Error(
            "Contours update failed: gdal_contour not found. Install GDAL (ensure `gdal_contour` is on PATH) or install QGIS and set PTK_GDAL_CONTOUR_BIN to the bundled binary, e.g. /Applications/QGIS*.app/Contents/MacOS/gdal_contour."
          );
        }
      } else {
        throw error;
      }
    }

    if (provider.contourSmoothingMode !== "off") {
      const rawContours = await readFile(generatedContoursPath, "utf8");
      const smoothedContours = smoothContourGeoJsonText(rawContours, provider.contourSmoothingMode);
      await writeFile(generatedContoursPath, smoothedContours, "utf8");
    }

    const terrainBandArgs = [
      "-p",
      "-amin",
      "eleMin",
      "-amax",
      "eleMax",
      "-i",
      String(contourIntervalMeters),
      "-f",
      "GeoJSON",
      demPath,
      generatedTerrainBandsPath
    ];

    try {
      await execFileFn(provider.gdalContourBin, terrainBandArgs);
    } catch (error: unknown) {
      if (!env.PTK_GDAL_CONTOUR_BIN && looksLikeSpawnENOENT(error)) {
        const qgisBin = await resolveQgisGdalContourBinFn();
        if (qgisBin) {
          await execFileFn(qgisBin, terrainBandArgs);
        } else {
          throw new Error(
            "Terrain bands update failed: gdal_contour not found. Install GDAL (ensure `gdal_contour` is on PATH) or install QGIS and set PTK_GDAL_CONTOUR_BIN to the bundled binary."
          );
        }
      } else {
        throw error;
      }
    }

    const imported = await importContoursFn({
      workspacePath: args.workspacePath,
      inputPath: generatedContoursPath,
      outputPath: args.outputPath,
      updatedAt
    });
    const importedTerrainBands = await importTerrainBandsFn({
      workspacePath: args.workspacePath,
      inputPath: generatedTerrainBandsPath,
      updatedAt
    });

    return {
      workspacePath: imported.workspacePath,
      outputPath: imported.outputPath,
      importedFeatureCount: imported.importedFeatureCount,
      importedTerrainBandCount: importedTerrainBands.importedFeatureCount,
      checksumSha256: imported.checksumSha256,
      queryHash,
      provider: provider.provider,
      demUrl,
      contourIntervalMeters,
      bufferMeters
    };
  } catch (error: unknown) {
    const failed = await readResortWorkspace(args.workspacePath);
    const message = error instanceof Error ? error.message : String(error);
    await writeResortWorkspace(
      args.workspacePath,
      withLayerState(failed, "contours", { status: "failed", queryHash, updatedAt, error: message })
    );
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
      [layer]: { ...current, ...state }
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
    if (!Array.isArray(point) || point.length < 2) continue;
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

function computeBufferedBbox(ring: [number, number][], bufferMeters: number): {
  minLon: number; minLat: number; maxLon: number; maxLat: number;
} {
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
