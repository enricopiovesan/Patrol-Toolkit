import type maplibregl from "maplibre-gl";

export type ContourOverlayConfig = {
  enabled: boolean;
  sourceId: string;
  layerId: string;
  source: maplibregl.RasterSourceSpecification;
  layer: maplibregl.RasterLayerSpecification;
};

export type ContourOverlayEnv = Partial<Record<string, string | boolean | undefined>>;

const DEFAULT_MIN_ZOOM = 12;
const DEFAULT_MAX_ZOOM = 16;
const DEFAULT_OPACITY = 0.6;

export function resolveContourOverlayConfig(
  env: ContourOverlayEnv = import.meta.env as unknown as ContourOverlayEnv
): ContourOverlayConfig | null {
  const rawUrl = readString(env, "VITE_CONTOUR_TILES_URL");
  if (!rawUrl) {
    return null;
  }

  const tilesUrl = rawUrl.trim();
  if (!looksLikeRasterTileTemplate(tilesUrl)) {
    return null;
  }

  const attribution = readString(env, "VITE_CONTOUR_ATTRIBUTION") ?? "Contour data source";
  const tileSize = clampInteger(readNumber(env, "VITE_CONTOUR_TILE_SIZE"), 128, 512) ?? 256;
  const minzoom = clampInteger(readNumber(env, "VITE_CONTOUR_MIN_ZOOM"), 0, 22) ?? DEFAULT_MIN_ZOOM;
  const maxzoom = clampInteger(readNumber(env, "VITE_CONTOUR_MAX_ZOOM"), minzoom, 22) ?? DEFAULT_MAX_ZOOM;
  const opacity = clampNumber(readNumber(env, "VITE_CONTOUR_OPACITY"), 0, 1) ?? DEFAULT_OPACITY;

  const sourceId = "ptk-contour-overlay";
  const layerId = "ptk-contour-overlay-raster";

  return {
    enabled: true,
    sourceId,
    layerId,
    source: {
      type: "raster",
      tiles: [tilesUrl],
      tileSize,
      attribution,
      minzoom,
      maxzoom
    },
    layer: {
      id: layerId,
      type: "raster",
      source: sourceId,
      minzoom,
      maxzoom,
      paint: {
        "raster-opacity": opacity
      }
    }
  };
}

function readString(env: ContourOverlayEnv, key: string): string | null {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(env: ContourOverlayEnv, key: string): number | null {
  const value = env[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampInteger(value: number | null, min: number, max: number): number | null {
  if (value === null) {
    return null;
  }
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, min), max);
}

function clampNumber(value: number | null, min: number, max: number): number | null {
  if (value === null) {
    return null;
  }
  return Math.min(Math.max(value, min), max);
}

function looksLikeRasterTileTemplate(url: string): boolean {
  return /\{z\}/u.test(url) && /\{x\}/u.test(url) && /\{y\}/u.test(url);
}

