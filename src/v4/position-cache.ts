import type { LngLat } from "../resort-pack/types";

export type V4LastKnownPosition = {
  coordinates: LngLat;
  accuracy: number;
  recordedAtIso: string;
};

export const V4_LAST_POSITION_STORAGE_KEY = "ptk.v4.lastKnownPosition";

export function readStoredLastKnownPosition(storage: Storage | null): V4LastKnownPosition | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(V4_LAST_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<V4LastKnownPosition> | null;
    if (!parsed || !Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
      return null;
    }
    const [lng, lat] = parsed.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }
    const accuracy = Number(parsed.accuracy);
    if (!Number.isFinite(accuracy)) {
      return null;
    }
    if (typeof parsed.recordedAtIso !== "string" || Number.isNaN(Date.parse(parsed.recordedAtIso))) {
      return null;
    }
    return {
      coordinates: [lng, lat],
      accuracy,
      recordedAtIso: parsed.recordedAtIso
    };
  } catch {
    return null;
  }
}

export function writeStoredLastKnownPosition(
  storage: Storage | null,
  position: { coordinates: LngLat; accuracy: number },
  now = new Date()
): void {
  if (!storage) {
    return;
  }
  try {
    const payload: V4LastKnownPosition = {
      coordinates: [position.coordinates[0], position.coordinates[1]],
      accuracy: position.accuracy,
      recordedAtIso: now.toISOString()
    };
    storage.setItem(V4_LAST_POSITION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}
