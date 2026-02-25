import type { SelectableResortPack } from "../resort-pack/catalog";
import type { ResortPackListItem } from "../resort-pack/repository";
import { resolveAppUrl } from "../runtime/base-url";
import { distanceMetersBetween } from "../geometry/primitives";
import type { GeoPolygon, LngLat } from "../resort-pack/types";

export type SelectResortCardStatus =
  | "installed"
  | "update-available"
  | "catalog-only";

export type SelectResortCardViewModel = {
  resortId: string;
  resortName: string;
  locationLabel: string;
  thumbnailImageUrl: string;
  thumbnailFallbackUrl: string;
  versionLabel: string;
  lastUpdatedLabel: string | null;
  statusBadges: string[];
  status: SelectResortCardStatus;
  thumbnailStatusLabel: string;
};

export type SelectResortPageViewModel = {
  query: string;
  cards: SelectResortCardViewModel[];
};

export type SelectResortSortingInputs = {
  userPosition?: LngLat | null;
  resortCentersById?: Record<string, LngLat | undefined>;
};

export function buildSelectResortPageViewModel(
  catalogEntries: SelectableResortPack[],
  installedPacks: ResortPackListItem[],
  query: string,
  sorting?: SelectResortSortingInputs
): SelectResortPageViewModel {
  const normalizedQuery = query.trim();
  const installedById = new Map(installedPacks.map((item) => [item.id, item]));

  const cards = catalogEntries
    .map((entry) => toCardViewModel(entry, installedById.get(entry.resortId)))
    .filter((card) => matchesSearch(card, normalizedQuery))
    .sort((left, right) => left.resortName.localeCompare(right.resortName));

  const sortedCards = sortSelectResortCardsByDistance(cards, {
    userPosition: sorting?.userPosition ?? null,
    resortCentersById: sorting?.resortCentersById ?? {}
  });

  return {
    query,
    cards: sortedCards
  };
}

export function sortSelectResortCardsByDistance(
  cards: SelectResortCardViewModel[],
  input: {
    userPosition: LngLat | null;
    resortCentersById: Record<string, LngLat | undefined>;
  }
): SelectResortCardViewModel[] {
  if (!input.userPosition) {
    return cards;
  }

  const sortable: Array<{ card: SelectResortCardViewModel; distanceMeters: number }> = [];
  const unsortable: SelectResortCardViewModel[] = [];

  for (const card of cards) {
    const center = input.resortCentersById[card.resortId];
    if (!center) {
      unsortable.push(card);
      continue;
    }
    sortable.push({
      card,
      distanceMeters: distanceMetersBetween(input.userPosition, center)
    });
  }

  if (sortable.length === 0) {
    return cards;
  }

  sortable.sort((left, right) => left.distanceMeters - right.distanceMeters);
  return [...sortable.map((item) => item.card), ...unsortable];
}

function toCardViewModel(
  entry: SelectableResortPack,
  installed: ResortPackListItem | undefined
): SelectResortCardViewModel {
  const installedVersion = installed?.sourceVersion;
  const hasInstalled = Boolean(installed);
  const updateAvailable = hasInstalled && installedVersion !== undefined && installedVersion !== entry.version;

  const status: SelectResortCardStatus = updateAvailable
    ? "update-available"
    : hasInstalled
      ? "installed"
      : "catalog-only";

  const statusBadges = buildStatusBadges({
    status,
    entryVersion: entry.version
  });

  return {
    resortId: entry.resortId,
    resortName: entry.resortName,
    locationLabel: formatResortLocation(entry.resortId, entry.resortName),
    thumbnailImageUrl: buildResortThumbnailUrl(entry.resortName),
    thumbnailFallbackUrl: resolveAppUrl("/assets/resort_placeholder.png"),
    versionLabel: `v${entry.version.replace(/^v/iu, "")}`,
    lastUpdatedLabel: formatUpdatedLabel(installed?.updatedAt ?? entry.createdAt),
    statusBadges,
    status,
    thumbnailStatusLabel: hasInstalled ? "Offline ready" : "Not installed"
  };
}

export function buildResortThumbnailUrl(resortName: string): string {
  const normalized = resortName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");

  const fileName = normalized.length > 0 ? `${normalized}.png` : "resort_placeholder.png";
  return resolveAppUrl(`/assets/${fileName}`);
}

function buildStatusBadges(input: {
  status: SelectResortCardStatus;
  entryVersion: string;
}): string[] {
  const versionBadge = `Pack ${input.entryVersion}`;
  if (input.status === "update-available") {
    return ["Update available", "Offline ready", versionBadge];
  }
  if (input.status === "installed") {
    return ["Offline ready", versionBadge];
  }
  return ["Not installed", versionBadge];
}

function matchesSearch(card: SelectResortCardViewModel, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystack = `${card.resortName} ${card.locationLabel}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/u)
    .filter((token) => token.length > 0)
    .every((token) => haystack.includes(token));
}

export function formatResortLocation(resortId: string, resortName: string): string {
  const parts = resortId.split("_").filter((part) => part.length > 0);
  const countryCode = parts[0]?.toUpperCase() ?? "";
  const cityToken = parts[1] ?? "";
  if (cityToken.length > 0 && countryCode.length > 0) {
    return `${humanizeToken(cityToken)}, ${countryCode}`;
  }

  const fallback = resortName.split(",")[0]?.trim() ?? resortName.trim();
  return fallback.length > 0 ? fallback : resortId;
}

export function formatUpdatedLabel(input: string | undefined): string | null {
  if (!input) {
    return null;
  }

  const timestamp = Date.parse(input);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function humanizeToken(token: string): string {
  return token
    .split(/[-_]/u)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function deriveResortCenterFromBoundary(boundary: GeoPolygon | undefined): LngLat | null {
  if (!boundary) {
    return null;
  }
  const ring = boundary.coordinates[0];
  if (!ring || ring.length === 0) {
    return null;
  }

  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
