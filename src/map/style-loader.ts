import type maplibregl from "maplibre-gl";
import type { ResortPack } from "../resort-pack/types";

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

  const normalized = normalizeRelativePath(stylePath);

  try {
    const response = await fetchFn(normalized);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isStyleSpecification(payload)) {
      throw new Error("Invalid style payload.");
    }
    const hydratedStyle = injectPmtilesSourceUrls(payload, pack.basemap.pmtilesPath);

    return {
      key: `pack:${pack.resort.id}:${normalized}`,
      style: hydratedStyle
    };
  } catch {
    return {
      key: `fallback:${pack.resort.id}`,
      style: OFFLINE_FALLBACK_STYLE
    };
  }
}

function injectPmtilesSourceUrls(
  style: maplibregl.StyleSpecification,
  pmtilesPath: string
): maplibregl.StyleSpecification {
  const nextStyle = structuredClone(style);
  const vectorSourceNames = Object.entries(nextStyle.sources)
    .filter(([, source]) => (source as { type?: string }).type === "vector")
    .map(([name]) => name);

  const pmtilesUrl = `pmtiles://${normalizeRelativePath(pmtilesPath)}`;
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
        hasPmtilesVectorSource = true;
        continue;
      }

      if (looksLikeLocalPmtilesPath(source.url)) {
        source.url = `pmtiles://${normalizeRelativePath(source.url)}`;
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

function isStyleSpecification(value: unknown): value is maplibregl.StyleSpecification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { version?: unknown; sources?: unknown; layers?: unknown };
  return candidate.version === 8 && typeof candidate.sources === "object" && Array.isArray(candidate.layers);
}
