import { describe, expect, it } from "vitest";
import {
  resolvePhraseBoundaryState,
  shouldAutoRegeneratePhrase,
  shouldShowPhraseRegenerateButton
} from "./phrase-ux-state";
import type { GeoPolygon, LngLat } from "../resort-pack/types";

const boundary: GeoPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-117.0, 51.0],
      [-116.9, 51.0],
      [-116.9, 51.1],
      [-117.0, 51.1],
      [-117.0, 51.0]
    ]
  ]
};

describe("phrase-ux-state", () => {
  it("treats missing point or boundary as unknown boundary state", () => {
    expect(resolvePhraseBoundaryState(null, boundary)).toBe("unknown");
    expect(resolvePhraseBoundaryState([-116.95, 51.05], undefined)).toBe("unknown");
  });

  it("classifies inside/outside boundary", () => {
    expect(resolvePhraseBoundaryState([-116.95, 51.05], boundary)).toBe("inside");
    expect(resolvePhraseBoundaryState([-116.85, 51.05], boundary)).toBe("outside");
  });

  it("auto-regenerates on first raw point while my-location tab is active", () => {
    expect(
      shouldAutoRegeneratePhrase({
        selectedTab: "my-location",
        previousRawPoint: null,
        currentRawPoint: [-116.95, 51.05]
      })
    ).toBe(true);
  });

  it("does not auto-regenerate outside my-location tab", () => {
    expect(
      shouldAutoRegeneratePhrase({
        selectedTab: "runs-check",
        previousRawPoint: [-116.95, 51.05],
        currentRawPoint: [-116.949, 51.051]
      })
    ).toBe(false);
  });

  it("auto-regenerates only when raw-point movement exceeds threshold", () => {
    const previous: LngLat = [-116.95, 51.05];
    const smallMove: LngLat = [-116.94999, 51.05001];
    const bigMove: LngLat = [-116.9498, 51.0501];

    expect(
      shouldAutoRegeneratePhrase({
        selectedTab: "my-location",
        previousRawPoint: previous,
        currentRawPoint: smallMove,
        thresholdMeters: 10
      })
    ).toBe(false);

    expect(
      shouldAutoRegeneratePhrase({
        selectedTab: "my-location",
        previousRawPoint: previous,
        currentRawPoint: bigMove,
        thresholdMeters: 10
      })
    ).toBe(true);
  });

  it("throws on negative threshold", () => {
    expect(() =>
      shouldAutoRegeneratePhrase({
        selectedTab: "my-location",
        previousRawPoint: [-116.95, 51.05],
        currentRawPoint: [-116.94, 51.06],
        thresholdMeters: -1
      })
    ).toThrow("thresholdMeters");
  });

  it("hides phrase button when no usable position or outside boundary", () => {
    expect(shouldShowPhraseRegenerateButton({ hasUsablePosition: false, boundaryState: "unknown" })).toBe(false);
    expect(shouldShowPhraseRegenerateButton({ hasUsablePosition: true, boundaryState: "outside" })).toBe(false);
    expect(shouldShowPhraseRegenerateButton({ hasUsablePosition: true, boundaryState: "inside" })).toBe(true);
    expect(shouldShowPhraseRegenerateButton({ hasUsablePosition: true, boundaryState: "unknown" })).toBe(true);
  });
});

