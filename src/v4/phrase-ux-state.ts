import { distanceMetersBetween, pointInPolygon } from "../geometry/primitives";
import type { GeoPolygon, LngLat } from "../resort-pack/types";

export type PhraseAutoRegenerationTab = "my-location" | "runs-check" | "sweeps";

export type PhraseBoundaryState = "inside" | "outside" | "unknown";

export function resolvePhraseBoundaryState(
  point: LngLat | null,
  boundary: GeoPolygon | undefined
): PhraseBoundaryState {
  if (!point || !boundary) {
    return "unknown";
  }
  return pointInPolygon(point, boundary) ? "inside" : "outside";
}

export function shouldAutoRegeneratePhrase(params: {
  selectedTab: PhraseAutoRegenerationTab;
  previousRawPoint: LngLat | null;
  currentRawPoint: LngLat;
  thresholdMeters?: number;
}): boolean {
  if (params.selectedTab !== "my-location") {
    return false;
  }

  if (!params.previousRawPoint) {
    return true;
  }

  const thresholdMeters = params.thresholdMeters ?? 10;
  if (thresholdMeters < 0) {
    throw new Error("thresholdMeters must be non-negative.");
  }

  return distanceMetersBetween(params.previousRawPoint, params.currentRawPoint) > thresholdMeters;
}

export function shouldShowPhraseRegenerateButton(params: {
  hasUsablePosition: boolean;
  boundaryState: PhraseBoundaryState;
}): boolean {
  if (!params.hasUsablePosition) {
    return false;
  }
  return params.boundaryState !== "outside";
}

