import type maplibregl from "maplibre-gl";
import type { ResortPack } from "../resort-pack/types";

export const OFFLINE_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Patrol Toolkit Fallback Basemap",
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster"
    }
  ]
};

export async function resolveStyleForPack(
  pack: ResortPack | null,
  fetchFn: typeof fetch = fetch
): Promise<{ key: string; style: maplibregl.StyleSpecification }> {
  if (!pack) {
    return {
      key: "fallback",
      style: OFFLINE_FALLBACK_STYLE
    };
  }

  const stylePath = pack.basemap.stylePath;
  if (!isLocalRelativePath(stylePath)) {
    return {
      key: `fallback:${pack.resort.id}`,
      style: OFFLINE_FALLBACK_STYLE
    };
  }

  const url = normalizeRelativePath(stylePath);
  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isStyleSpecification(payload)) {
      throw new Error("Invalid style payload");
    }

    return {
      key: `pack:${pack.resort.id}:${url}`,
      style: payload
    };
  } catch {
    return {
      key: `fallback:${pack.resort.id}`,
      style: OFFLINE_FALLBACK_STYLE
    };
  }
}

function normalizeRelativePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed.replace(/^\.\/+/, "")}`;
}

function isLocalRelativePath(path: string): boolean {
  if (!path || path.startsWith("//") || path.includes("://")) {
    return false;
  }
  return !path.split(/[\\/]/u).some((segment) => segment === "..");
}

function isStyleSpecification(value: unknown): value is maplibregl.StyleSpecification {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { version?: unknown; sources?: unknown; layers?: unknown };
  return candidate.version === 8 && typeof candidate.sources === "object" && Array.isArray(candidate.layers);
}
