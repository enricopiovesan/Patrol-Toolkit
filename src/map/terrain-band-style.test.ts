import { describe, expect, it } from "vitest";
import { buildTerrainBandFillPaint } from "./terrain-band-style";

describe("terrain-band-style", () => {
  it("builds hypsometric fill paint from shared terrain config", () => {
    expect(buildTerrainBandFillPaint()).toEqual({
      "fill-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "elevationMidMeters"]], 0],
        0, "#dfead8",
        1400, "#d7e3cf",
        1800, "#d8d2bc",
        2200, "#e6dec8",
        2800, "#f2eadb"
      ],
      "fill-opacity": 0.22
    });
  });
});

