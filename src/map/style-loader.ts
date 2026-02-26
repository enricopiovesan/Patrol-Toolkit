import type maplibregl from "maplibre-gl";
import type { ResortPack } from "../resort-pack/types";
import { resolveAppUrl } from "../runtime/base-url";
import { readAerialConfigFromEnv } from "./aerial-config";

export const OFFLINE_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Patrol Toolkit Offline Fallback",
  sources: {},
  layers: [
    {
      id: "offline-fallback-background",
      type: "background",
      paint: {
        "background-color": "#dce7e4"
      }
    }
  ]
};

const NETWORK_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Patrol Toolkit Network Fallback",
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
  fetchFn: typeof fetch = fetch,
  isOnlineFn: () => boolean = defaultIsOnline,
  options?: { aerialMode?: boolean }
): Promise<{ key: string; style: maplibregl.StyleSpecification }> {
  const aerialMode = options?.aerialMode === true;
  const fallbackStyle = isOnlineFn() ? NETWORK_FALLBACK_STYLE : OFFLINE_FALLBACK_STYLE;

  if (aerialMode && isOnlineFn()) {
    const aerialConfig = readAerialConfigFromEnv();
    if (aerialConfig.enabled) {
      return {
        key: `aerial:${aerialConfig.provider}`,
        style: {
          version: 8,
          name: "Patrol Toolkit Aerial",
          sources: {
            "aerial-raster": {
              type: "raster",
              tiles: [aerialConfig.tileUrlTemplate],
              tileSize: 256,
              attribution: aerialConfig.attribution
            }
          },
          layers: [
            {
              id: "aerial-raster-layer",
              type: "raster",
              source: "aerial-raster"
            }
          ]
        }
      };
    }
  }

  if (!pack) {
    return {
      key: "fallback",
      style: fallbackStyle
    };
  }

  const stylePath = pack.basemap.stylePath;
  if (!isLocalRelativePath(stylePath)) {
    return {
      key: `fallback:${pack.resort.id}`,
      style: fallbackStyle
    };
  }

  const normalized = normalizeRelativePath(stylePath);
  const styleCandidates = [normalized, maybeCanonicalizePackStylePath(normalized)].filter(
    (path, index, all) => all.indexOf(path) === index
  );

  for (const styleCandidate of styleCandidates) {
    const resolvedStyleUrl = resolveAppUrl(styleCandidate);
    try {
      const response = await fetchFn(resolvedStyleUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!isStyleSpecification(payload)) {
        throw new Error("Invalid style payload.");
      }
      const hydratedStyle = injectPmtilesSourceUrls(payload, pack.basemap.pmtilesPath);

      return {
        key: `pack:${pack.resort.id}:${resolvedStyleUrl}`,
        style: hydratedStyle
      };
    } catch {
      // Try next candidate.
    }
  }

  return {
    key: `fallback:${pack.resort.id}`,
    style: fallbackStyle
  };
}

function defaultIsOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === true;
}

function injectPmtilesSourceUrls(
  style: maplibregl.StyleSpecification,
  pmtilesPath: string
): maplibregl.StyleSpecification {
  const nextStyle = structuredClone(style);
  const vectorSourceNames = Object.entries(nextStyle.sources)
    .filter(([, source]) => (source as { type?: string }).type === "vector")
    .map(([name]) => name);

  const pmtilesUrl = `pmtiles://${resolveAppUrl(normalizeRelativePath(pmtilesPath))}`;
  let hasPmtilesVectorSource = false;

  for (const sourceName of vectorSourceNames) {
    const source = nextStyle.sources[sourceName] as
      | { type?: string; url?: string; tiles?: unknown; [key: string]: unknown }
      | undefined;
    if (!source || source.type !== "vector") {
      continue;
    }

    if (typeof source.url === "string") {
      if (source.url.startsWith("pmtiles://")) {
        // Normalize any embedded PMTiles URL to the active pack archive path so
        // the style source matches the protocol-registered PMTiles instance.
        source.url = pmtilesUrl;
        hasPmtilesVectorSource = true;
        continue;
      }

      if (looksLikeLocalPmtilesPath(source.url)) {
        source.url = `pmtiles://${resolveAppUrl(normalizeRelativePath(source.url))}`;
        hasPmtilesVectorSource = true;
      }
    }
  }

  if (!hasPmtilesVectorSource && vectorSourceNames.length > 0) {
    const firstVectorSourceName = vectorSourceNames[0];
    const firstVectorSource = nextStyle.sources[firstVectorSourceName] as
      | { url?: string; tiles?: unknown; [key: string]: unknown }
      | undefined;
    if (firstVectorSource) {
      firstVectorSource.url = pmtilesUrl;
      delete firstVectorSource.tiles;
    }
  }

  return nextStyle;
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

function looksLikeLocalPmtilesPath(path: string): boolean {
  if (!path.toLowerCase().endsWith(".pmtiles")) {
    return false;
  }

  if (path.startsWith("pmtiles://")) {
    return false;
  }

  return !path.includes("://");
}

function maybeCanonicalizePackStylePath(path: string): string {
  const match = /^\/packs\/([^/]+)\/style\.json$/iu.exec(path);
  if (!match) {
    return path;
  }

  const resortId = match[1];
  const canonical = resortId
    .split("_")
    .filter((part) => part.length > 0)
    .map((part, index) =>
      index === 0 ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join("_");
  return resolveAppUrl(`/packs/${canonical}/style.json`);
}

function isStyleSpecification(value: unknown): value is maplibregl.StyleSpecification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { version?: unknown; sources?: unknown; layers?: unknown };
  return candidate.version === 8 && typeof candidate.sources === "object" && Array.isArray(candidate.layers);
}
