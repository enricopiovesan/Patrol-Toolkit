import type { ViewportMode } from "./viewport";

export type ToolPanelPresentation = "bottom-sheet" | "sidebar";
export type ToolPanelVisibility = "hidden" | "visible";

export interface ToolPanelViewState {
  presentation: ToolPanelPresentation;
  visibility: ToolPanelVisibility;
  fullscreenSupported: boolean;
}

export function createInitialToolPanelState(viewport: ViewportMode): ToolPanelViewState {
  switch (viewport) {
    case "small":
      return {
        presentation: "bottom-sheet",
        visibility: "visible",
        fullscreenSupported: true
      };
    case "medium":
      return {
        presentation: "sidebar",
        visibility: "hidden",
        fullscreenSupported: true
      };
    case "large":
      return {
        presentation: "sidebar",
        visibility: "visible",
        fullscreenSupported: false
      };
  }
}

