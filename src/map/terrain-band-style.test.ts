import { describe, expect, it } from "vitest";
import {
  buildTerrainBandDarkShadeFilter,
  buildTerrainBandDarkShadePaint,
  buildTerrainBandFillPaint,
  buildTerrainBandLightShadeFilter,
  buildTerrainBandLightShadePaint
} from "./terrain-band-style";

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

  it("builds faux shading paints and filters from shared terrain config", () => {
    expect(buildTerrainBandDarkShadeFilter()).toEqual([
      "any",
      [
        "==",
        [
          "%",
          [
            "floor",
            [
              "/",
              [
                "coalesce",
                ["to-number", ["get", "elevationMinMeters"]],
                ["to-number", ["get", "elevationMidMeters"]],
                0
              ],
              20
            ]
          ],
          4
        ],
        0
      ],
      [
        "==",
        [
          "%",
          [
            "floor",
            [
              "/",
              [
                "coalesce",
                ["to-number", ["get", "elevationMinMeters"]],
                ["to-number", ["get", "elevationMidMeters"]],
                0
              ],
              20
            ]
          ],
          4
        ],
        1
      ]
    ]);
    expect(buildTerrainBandLightShadeFilter()).toEqual([
      "==",
      [
        "%",
        [
          "floor",
          [
            "/",
            [
              "coalesce",
              ["to-number", ["get", "elevationMinMeters"]],
              ["to-number", ["get", "elevationMidMeters"]],
              0
            ],
            20
          ]
        ],
        4
      ],
      3
    ]);

    expect(buildTerrainBandDarkShadePaint()).toEqual({
      "fill-color": "#6f5a45",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 0.022, 14, 0.0385, 16, 0.0495]
    });
    expect(buildTerrainBandLightShadePaint()).toEqual({
      "fill-color": "#fff8ea",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 0.0165, 14, 0.0286, 16, 0.0374]
    });
  });
});
