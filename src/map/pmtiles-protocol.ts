import maplibregl from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import type { ResortPack } from "../resort-pack/types";

let protocol: Protocol | null = null;
let registered = false;

export function ensurePmtilesProtocolRegistered(): void {
  if (registered) {
    return;
  }

  protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}

export function ensurePackPmtilesArchiveLoaded(pack: ResortPack | null): void {
  if (!pack) {
    return;
  }

  ensurePmtilesProtocolRegistered();
  if (!protocol) {
    return;
  }

  const normalizedPath = normalizeRelativePath(pack.basemap.pmtilesPath);
  const sourceUrl = `pmtiles://${normalizedPath}`;

  if (!protocol.get(sourceUrl)) {
    protocol.add(new PMTiles(sourceUrl));
  }
}

function normalizeRelativePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed.replace(/^\.\/+/, "")}`;
}
