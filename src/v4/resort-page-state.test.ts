import { describe, expect, it } from "vitest";
import {
  createInitialResortPageUiState,
  selectResortPageTab,
  setResortPagePanelOpen,
  syncResortPageUiStateForViewport,
  toggleResortPageFullscreen
} from "./resort-page-state";

describe("resort-page-state", () => {
  it("creates viewport-specific initial state", () => {
    expect(createInitialResortPageUiState("small")).toMatchObject({
      selectedTab: "my-location",
      panelOpen: true,
      fullscreen: false
    });
    expect(createInitialResortPageUiState("medium")).toMatchObject({
      panelOpen: false,
      fullscreen: false
    });
    expect(createInitialResortPageUiState("large")).toMatchObject({
      panelOpen: true,
      fullscreen: false
    });
  });

  it("selects tabs without mutating unrelated state", () => {
    const initial = createInitialResortPageUiState("small");
    const next = selectResortPageTab(initial, "runs-check");
    expect(next.selectedTab).toBe("runs-check");
    expect(next.panelOpen).toBe(true);
    expect(selectResortPageTab(next, "runs-check")).toBe(next);
  });

  it("toggles fullscreen on small by hiding and restoring panel", () => {
    const initial = createInitialResortPageUiState("small");
    const entered = toggleResortPageFullscreen(initial, "small", true);
    expect(entered.fullscreen).toBe(true);
    expect(entered.panelOpen).toBe(false);
    expect(entered.panelOpenBeforeFullscreen).toBe(true);

    const exited = toggleResortPageFullscreen(entered, "small", true);
    expect(exited.fullscreen).toBe(false);
    expect(exited.panelOpen).toBe(true);
  });

  it("restores hidden panel on medium after fullscreen exit", () => {
    const initial = createInitialResortPageUiState("medium");
    expect(initial.panelOpen).toBe(false);
    const entered = toggleResortPageFullscreen(initial, "medium", true);
    const exited = toggleResortPageFullscreen(entered, "medium", true);
    expect(exited.panelOpen).toBe(false);
  });

  it("does not enable fullscreen on large or unsupported viewports", () => {
    const initial = createInitialResortPageUiState("large");
    expect(toggleResortPageFullscreen(initial, "large", false)).toBe(initial);
    expect(toggleResortPageFullscreen(initial, "large", true)).toBe(initial);
  });

  it("tracks panel visibility changes outside fullscreen", () => {
    const initial = createInitialResortPageUiState("medium");
    const opened = setResortPagePanelOpen(initial, true);
    expect(opened.panelOpen).toBe(true);
    expect(opened.panelOpenBeforeFullscreen).toBe(true);
  });

  it("preserves fullscreen state and applies viewport defaults on resize sync", () => {
    const small = createInitialResortPageUiState("small");
    const fullscreen = toggleResortPageFullscreen(small, "small", true);
    const syncedMedium = syncResortPageUiStateForViewport(fullscreen, "medium");
    expect(syncedMedium.fullscreen).toBe(true);
    expect(syncedMedium.panelOpen).toBe(false);

    const syncedLarge = syncResortPageUiStateForViewport(fullscreen, "large");
    expect(syncedLarge.fullscreen).toBe(false);
    expect(syncedLarge.panelOpen).toBe(true);
  });
});
