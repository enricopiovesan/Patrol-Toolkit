import { describe, expect, it } from "vitest";
import {
  applyGpsError,
  applyGpsPosition,
  createInitialGpsUiState,
  dismissGpsGuidanceModal,
  reopenGpsGuidanceModal,
  requestGpsRetry
} from "./gps-ui-state";

describe("gps-ui-state", () => {
  it("starts in requesting state with modal closed", () => {
    expect(createInitialGpsUiState()).toMatchObject({
      status: "requesting",
      guidanceModalOpen: false
    });
  });

  it("switches to ready state from position updates", () => {
    const next = applyGpsPosition(createInitialGpsUiState(), 148.7);
    expect(next.status).toBe("ready");
    expect(next.statusText).toBe("GPS ready (±149m).");
    expect(next.guidanceModalOpen).toBe(false);
  });

  it("opens guidance modal for permission denied", () => {
    const next = applyGpsError(createInitialGpsUiState(), {
      kind: "permission-denied",
      message: "Location permission denied."
    });
    expect(next.status).toBe("disabled");
    expect(next.guidanceModalOpen).toBe(true);
    expect(next.guidanceBody).toContain("browser settings");
  });

  it("dismisses modal and keeps disabled state", () => {
    const errored = applyGpsError(createInitialGpsUiState(), {
      kind: "permission-denied",
      message: "Location permission denied."
    });
    const dismissed = dismissGpsGuidanceModal(errored);
    expect(dismissed.guidanceModalOpen).toBe(false);
    expect(dismissed.status).toBe("disabled");
  });

  it("retry resets status to requesting", () => {
    const errored = applyGpsError(createInitialGpsUiState(), {
      kind: "permission-denied",
      message: "Location permission denied."
    });
    const retried = requestGpsRetry(dismissGpsGuidanceModal(errored));
    expect(retried.status).toBe("requesting");
    expect(retried.guidanceModalOpen).toBe(false);
  });

  it("can reopen guidance modal after retry failure", () => {
    const base = dismissGpsGuidanceModal(
      applyGpsError(createInitialGpsUiState(), {
        kind: "permission-denied",
        message: "Location permission denied."
      })
    );
    expect(reopenGpsGuidanceModal(base).guidanceModalOpen).toBe(true);
  });
});
