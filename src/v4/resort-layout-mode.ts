import type { ViewportMode } from "./viewport";

export type ResortPanelLayoutMode = "sheet" | "sidebar";

export interface ResortLayoutInput {
  viewport: ViewportMode;
  widthPx: number;
  heightPx: number;
}

export const V5_MEDIUM_PORTRAIT_SHEET_RULE = {
  minWidthInclusive: 768,
  maxWidthInclusive: 834
} as const;

export const V5_MEDIUM_LANDSCAPE_SIDEBAR_RULE = {
  minHeightInclusive: 600
} as const;

export function shouldUseMediumPortraitSheetLayout(input: ResortLayoutInput): boolean {
  validateDimensions(input.widthPx, input.heightPx);
  if (input.viewport !== "medium") {
    return false;
  }
  const portrait = input.heightPx > input.widthPx;
  if (!portrait) {
    return false;
  }
  return (
    input.widthPx >= V5_MEDIUM_PORTRAIT_SHEET_RULE.minWidthInclusive &&
    input.widthPx <= V5_MEDIUM_PORTRAIT_SHEET_RULE.maxWidthInclusive
  );
}

export function resolveResortPanelLayoutMode(input: ResortLayoutInput): ResortPanelLayoutMode {
  validateDimensions(input.widthPx, input.heightPx);
  if (input.viewport === "small") {
    return "sheet";
  }
  if (shouldUseMediumPortraitSheetLayout(input)) {
    return "sheet";
  }
  if (input.viewport === "medium" && input.widthPx > input.heightPx) {
    if (input.heightPx < V5_MEDIUM_LANDSCAPE_SIDEBAR_RULE.minHeightInclusive) {
      return "sheet";
    }
  }
  return "sidebar";
}

function validateDimensions(widthPx: number, heightPx: number): void {
  if (!Number.isFinite(widthPx) || widthPx <= 0) {
    throw new Error(`Width must be a positive finite number, received ${String(widthPx)}.`);
  }
  if (!Number.isFinite(heightPx) || heightPx <= 0) {
    throw new Error(`Height must be a positive finite number, received ${String(heightPx)}.`);
  }
}
