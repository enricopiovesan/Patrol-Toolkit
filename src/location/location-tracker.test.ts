import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationTracker } from "./location-tracker";

describe("LocationTracker", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "geolocation"
  );

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalDescriptor) {
      Object.defineProperty(Navigator.prototype, "geolocation", originalDescriptor);
      return;
    }

    Reflect.deleteProperty(Navigator.prototype, "geolocation");
  });

  it("starts tracking and forwards positions", () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 45.1,
          longitude: 7.2,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({})
        },
        timestamp: Date.now(),
        toJSON: () => ({})
      });

      return 42;
    });

    const clearWatch = vi.fn();

    Object.defineProperty(Navigator.prototype, "geolocation", {
      configurable: true,
      value: { watchPosition, clearWatch }
    });

    const onPosition = vi.fn();
    const tracker = new LocationTracker({ onPosition });

    expect(tracker.start()).toBe(true);
    expect(tracker.isActive()).toBe(true);
    expect(onPosition).toHaveBeenCalledWith({
      latitude: 45.1,
      longitude: 7.2,
      accuracy: 5
    });

    tracker.stop();

    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(tracker.isActive()).toBe(false);
  });

  it("reports unsupported geolocation", () => {
    Reflect.deleteProperty(Navigator.prototype, "geolocation");

    const onError = vi.fn();
    const tracker = new LocationTracker({
      onPosition: vi.fn(),
      onError
    });

    expect(tracker.start()).toBe(false);
    expect(onError).toHaveBeenCalledWith("Geolocation unavailable on this device.", "unsupported");
  });

  it("does not create duplicate watch subscriptions", () => {
    const watchPosition = vi.fn(() => 99);
    const clearWatch = vi.fn();

    Object.defineProperty(Navigator.prototype, "geolocation", {
      configurable: true,
      value: { watchPosition, clearWatch }
    });

    const tracker = new LocationTracker({ onPosition: vi.fn() });

    expect(tracker.start()).toBe(true);
    expect(tracker.start()).toBe(true);
    expect(watchPosition).toHaveBeenCalledOnce();
  });

  it("maps geolocation API errors to operator-facing messages", () => {
    const watchPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({
          code: 1,
          message: "permission denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        } as GeolocationPositionError);

        return 7;
      }
    );

    Object.defineProperty(Navigator.prototype, "geolocation", {
      configurable: true,
      value: { watchPosition, clearWatch: vi.fn() }
    });

    const onError = vi.fn();
    const tracker = new LocationTracker({ onPosition: vi.fn(), onError });

    expect(tracker.start()).toBe(true);
    expect(onError).toHaveBeenCalledWith("Location permission denied.", "permission-denied");
  });
});
