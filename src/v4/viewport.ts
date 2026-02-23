export type ViewportMode = "small" | "medium" | "large";

export const VIEWPORT_BREAKPOINTS = {
  smallMaxExclusive: 768,
  mediumMaxExclusive: 1024
} as const;

export function classifyViewportWidth(widthPx: number): ViewportMode {
  if (!Number.isFinite(widthPx) || widthPx < 0) {
    throw new Error(`Viewport width must be a non-negative finite number, received ${String(widthPx)}.`);
  }

  if (widthPx < VIEWPORT_BREAKPOINTS.smallMaxExclusive) {
    return "small";
  }
  if (widthPx < VIEWPORT_BREAKPOINTS.mediumMaxExclusive) {
    return "medium";
  }
  return "large";
}

