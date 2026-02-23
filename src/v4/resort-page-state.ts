import { createInitialToolPanelState } from "./tool-panel-state";
import type { ViewportMode } from "./viewport";

export type ResortPageTabId = "my-location" | "runs-check" | "sweeps";

export interface ResortPageUiState {
  selectedTab: ResortPageTabId;
  panelOpen: boolean;
  fullscreen: boolean;
  panelOpenBeforeFullscreen: boolean;
}

export function createInitialResortPageUiState(viewport: ViewportMode): ResortPageUiState {
  const panelState = createInitialToolPanelState(viewport);
  const panelOpen = panelState.visibility === "visible";
  return {
    selectedTab: "my-location",
    panelOpen,
    fullscreen: false,
    panelOpenBeforeFullscreen: panelOpen
  };
}

export function selectResortPageTab(state: ResortPageUiState, tab: ResortPageTabId): ResortPageUiState {
  if (state.selectedTab === tab) {
    return state;
  }
  return {
    ...state,
    selectedTab: tab
  };
}

export function setResortPagePanelOpen(state: ResortPageUiState, open: boolean): ResortPageUiState {
  if (state.panelOpen === open && (!state.fullscreen || state.panelOpenBeforeFullscreen === open)) {
    return state;
  }
  return {
    ...state,
    panelOpen: open,
    panelOpenBeforeFullscreen: state.fullscreen ? state.panelOpenBeforeFullscreen : open
  };
}

export function toggleResortPageFullscreen(
  state: ResortPageUiState,
  viewport: ViewportMode,
  fullscreenSupported: boolean
): ResortPageUiState {
  if (!fullscreenSupported || viewport === "large") {
    return state;
  }

  if (!state.fullscreen) {
    return {
      ...state,
      fullscreen: true,
      panelOpenBeforeFullscreen: state.panelOpen,
      panelOpen: false
    };
  }

  return {
    ...state,
    fullscreen: false,
    panelOpen: state.panelOpenBeforeFullscreen
  };
}

export function syncResortPageUiStateForViewport(
  previous: ResortPageUiState,
  viewport: ViewportMode
): ResortPageUiState {
  const initialForViewport = createInitialResortPageUiState(viewport);

  if (viewport === "large") {
    return {
      ...previous,
      panelOpen: true,
      fullscreen: false,
      panelOpenBeforeFullscreen: true
    };
  }

  if (viewport === "small") {
    return {
      ...previous,
      panelOpen: previous.fullscreen ? false : true,
      fullscreen: previous.fullscreen,
      panelOpenBeforeFullscreen: previous.fullscreen ? previous.panelOpenBeforeFullscreen : true
    };
  }

  return {
    ...previous,
    panelOpen: previous.fullscreen ? false : false,
    fullscreen: previous.fullscreen,
    panelOpenBeforeFullscreen: previous.fullscreen ? previous.panelOpenBeforeFullscreen : initialForViewport.panelOpen
  };
}
