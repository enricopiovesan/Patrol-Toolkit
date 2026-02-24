export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type LocationTrackerErrorKind =
  | "permission-denied"
  | "position-unavailable"
  | "timeout"
  | "unsupported"
  | "unknown";

export type LocationTrackerCallbacks = {
  onPosition: (position: GeoPosition) => void;
  onError?: (message: string, kind: LocationTrackerErrorKind) => void;
};

const TRACKING_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1500,
  timeout: 8000
};

const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

export class LocationTracker {
  private watchId: number | null = null;

  constructor(private readonly callbacks: LocationTrackerCallbacks) {}

  start(): boolean {
    if (!("geolocation" in navigator)) {
      this.callbacks.onError?.("Geolocation unavailable on this device.", "unsupported");
      return false;
    }

    if (this.watchId !== null) {
      return true;
    }

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.callbacks.onPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          const mapped = mapGeolocationError(error);
          this.callbacks.onError?.(mapped.message, mapped.kind);
        },
        TRACKING_OPTIONS
      );
    } catch {
      this.callbacks.onError?.("Unable to start GPS tracking.", "unknown");
      this.watchId = null;
      return false;
    }

    return true;
  }

  stop(): void {
    if (!("geolocation" in navigator) || this.watchId === null) {
      return;
    }

    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  isActive(): boolean {
    return this.watchId !== null;
  }
}

function mapGeolocationError(error: GeolocationPositionError): {
  message: string;
  kind: LocationTrackerErrorKind;
} {
  if (error.code === GEOLOCATION_PERMISSION_DENIED) {
    return { message: "Location permission denied.", kind: "permission-denied" };
  }

  if (error.code === GEOLOCATION_POSITION_UNAVAILABLE) {
    return { message: "Current location unavailable.", kind: "position-unavailable" };
  }

  if (error.code === GEOLOCATION_TIMEOUT) {
    return { message: "Location request timed out.", kind: "timeout" };
  }

  return { message: "Unable to read device location.", kind: "unknown" };
}
