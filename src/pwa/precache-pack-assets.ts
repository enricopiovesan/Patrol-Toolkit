import type { ResortPack } from "../resort-pack/types";

const sentWarmups = new Set<string>();

type PrecacheMessage = {
  type: "PRECACHE_URLS";
  urls: string[];
};

export function requestPackAssetPrecache(pack: ResortPack | null): void {
  if (!pack || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const urls = [
    "/resort-packs/index.json",
    normalizeRelativePath(pack.basemap.stylePath),
    normalizeRelativePath(pack.basemap.pmtilesPath)
  ];
  const uniqueUrls = [...new Set(urls)];
  const dedupeKey = `${pack.resort.id}:${uniqueUrls.join("|")}`;
  if (sentWarmups.has(dedupeKey)) {
    return;
  }

  sentWarmups.add(dedupeKey);
  const message: PrecacheMessage = {
    type: "PRECACHE_URLS",
    urls: uniqueUrls
  };

  const postToController = (): boolean => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      return false;
    }

    controller.postMessage(message);
    return true;
  };

  if (postToController()) {
    return;
  }

  void navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message);
    })
    .catch(() => {
      // Best-effort warmup only.
    });
}

function normalizeRelativePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\.\/+/, "")}`;
}
