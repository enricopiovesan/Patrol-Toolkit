import { describe, expect, it } from "vitest";
import {
  readStoredLastKnownPosition,
  V4_LAST_POSITION_STORAGE_KEY,
  writeStoredLastKnownPosition
} from "./position-cache";

describe("position-cache", () => {
  it("round-trips a stored position", () => {
    const storage = window.localStorage;
    storage.clear();

    writeStoredLastKnownPosition(
      storage,
      {
        coordinates: [-116.95, 51.27],
        accuracy: 24
      },
      new Date("2026-03-10T12:00:00.000Z")
    );

    expect(readStoredLastKnownPosition(storage)).toEqual({
      coordinates: [-116.95, 51.27],
      accuracy: 24,
      recordedAtIso: "2026-03-10T12:00:00.000Z"
    });
  });

  it("returns null for invalid payload", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(V4_LAST_POSITION_STORAGE_KEY, "{bad-json");
    expect(readStoredLastKnownPosition(storage)).toBeNull();

    storage.setItem(V4_LAST_POSITION_STORAGE_KEY, JSON.stringify({ coordinates: ["x", 1] }));
    expect(readStoredLastKnownPosition(storage)).toBeNull();
  });

  it("tolerates missing storage", () => {
    expect(readStoredLastKnownPosition(null)).toBeNull();
    expect(() =>
      writeStoredLastKnownPosition(null, {
        coordinates: [-1, 1],
        accuracy: 10
      })
    ).not.toThrow();
  });
});
