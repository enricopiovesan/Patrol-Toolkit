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
        0, "#f6faf9",
        1400, "#f1f7fa",
        1800, "#edf4f9",
        2200, "#f5f8fc",
        2800, "#ffffff"
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
      "fill-color": "#5d7185",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 0.0825, 14, 0.132, 16, 0.15675]
    });
    expect(buildTerrainBandLightShadePaint()).toEqual({
      "fill-color": "#ffffff",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 0.066, 14, 0.1155, 16, 0.14025]
    });
  });
});
