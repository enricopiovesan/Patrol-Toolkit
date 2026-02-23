export type GpsErrorKind =
  | "permission-denied"
  | "position-unavailable"
  | "timeout"
  | "unsupported"
  | "unknown";

export interface V4GpsUiState {
  status: "requesting" | "ready" | "disabled";
  statusText: string;
  guidanceModalOpen: boolean;
  guidanceTitle: string;
  guidanceBody: string;
}

export function createInitialGpsUiState(): V4GpsUiState {
  return {
    status: "requesting",
    statusText: "Requesting GPS permission and location…",
    guidanceModalOpen: false,
    guidanceTitle: "Turn On Location",
    guidanceBody: defaultGuidanceBody()
  };
}

export function applyGpsPosition(state: V4GpsUiState, accuracyMeters: number): V4GpsUiState {
  return {
    ...state,
    status: "ready",
    statusText: `GPS ready (±${Math.round(accuracyMeters)}m).`,
    guidanceModalOpen: false
  };
}

export function applyGpsError(state: V4GpsUiState, params: { kind: GpsErrorKind; message: string }): V4GpsUiState {
  const message = params.message.trim() || fallbackMessageForKind(params.kind);
  const shouldOpenGuidance =
    params.kind === "permission-denied" || params.kind === "unsupported" || params.kind === "position-unavailable";

  return {
    ...state,
    status: "disabled",
    statusText: message,
    guidanceModalOpen: shouldOpenGuidance || state.guidanceModalOpen,
    guidanceTitle: "Turn On Location",
    guidanceBody: buildGuidanceBody(params.kind)
  };
}

export function dismissGpsGuidanceModal(state: V4GpsUiState): V4GpsUiState {
  if (!state.guidanceModalOpen) {
    return state;
  }
  return {
    ...state,
    guidanceModalOpen: false
  };
}

export function requestGpsRetry(state: V4GpsUiState): V4GpsUiState {
  return {
    ...state,
    status: "requesting",
    statusText: "Retrying location access…",
    guidanceModalOpen: false
  };
}

export function reopenGpsGuidanceModal(state: V4GpsUiState): V4GpsUiState {
  if (state.guidanceModalOpen) {
    return state;
  }
  return {
    ...state,
    guidanceModalOpen: true
  };
}

function buildGuidanceBody(kind: GpsErrorKind): string {
  if (kind === "permission-denied") {
    return "Location access is denied. Re-enable location permission for this site in browser settings, then return and tap Turn On Location again.";
  }
  if (kind === "unsupported") {
    return "Location services are unavailable on this device/browser. Enable location services or use a supported browser/device to continue.";
  }
  if (kind === "position-unavailable") {
    return "Location is currently unavailable. Move to an open area, confirm device location services are on, then try again.";
  }
  return defaultGuidanceBody();
}

function defaultGuidanceBody(): string {
  return "If location access is blocked, enable it in browser/device settings, then return and tap Turn On Location.";
}

function fallbackMessageForKind(kind: GpsErrorKind): string {
  switch (kind) {
    case "permission-denied":
      return "Location permission denied.";
    case "position-unavailable":
      return "Current location unavailable.";
    case "timeout":
      return "Location request timed out.";
    case "unsupported":
      return "Geolocation unavailable on this device.";
    default:
      return "Unable to read device location.";
  }
}
