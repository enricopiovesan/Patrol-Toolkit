import type { ResortPack } from "../resort-pack/types";
import type { ResortPageTabId } from "./resort-page-state";
import type { ViewportMode } from "./viewport";

export interface ResortPageHeaderViewModel {
  resortName: string;
  versionText: string;
  runsCountText: string;
  liftsCountText: string;
}

export interface ResortPageViewModel {
  viewport: ViewportMode;
  header: ResortPageHeaderViewModel;
  selectedTab: ResortPageTabId;
  panelOpen: boolean;
  fullscreenSupported: boolean;
  fullscreenActive: boolean;
}

export function buildResortPageHeaderViewModel(params: {
  resortName: string;
  sourceVersion?: string;
  pack: ResortPack;
}): ResortPageHeaderViewModel {
  const name = capitalizeResortName(params.resortName || params.pack.resort.name);
  const version = params.sourceVersion?.trim() || "v?";
  return {
    resortName: name,
    versionText: version,
    runsCountText: `${params.pack.runs.length} runs`,
    liftsCountText: `${params.pack.lifts.length} lifts`
  };
}

export function buildResortPageViewModel(params: {
  viewport: ViewportMode;
  resortName: string;
  sourceVersion?: string;
  pack: ResortPack;
  selectedTab: ResortPageTabId;
  panelOpen: boolean;
  fullscreenSupported: boolean;
  fullscreenActive: boolean;
}): ResortPageViewModel {
  return {
    viewport: params.viewport,
    header: buildResortPageHeaderViewModel({
      resortName: params.resortName,
      sourceVersion: params.sourceVersion,
      pack: params.pack
    }),
    selectedTab: params.selectedTab,
    panelOpen: params.panelOpen,
    fullscreenSupported: params.fullscreenSupported,
    fullscreenActive: params.fullscreenActive
  };
}

export function capitalizeResortName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed
    .split(/\s+/u)
    .map((word) => {
      const lower = word.toLocaleLowerCase();
      return lower.slice(0, 1).toLocaleUpperCase() + lower.slice(1);
    })
    .join(" ");
}
