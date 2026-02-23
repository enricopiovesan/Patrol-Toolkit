import { describe, expect, it } from "vitest";
import {
  buildResortPageHeaderViewModel,
  buildResortPageViewModel,
  capitalizeResortName
} from "./resort-page-model";
import type { ResortPack } from "../resort-pack/types";

const packFixture: ResortPack = {
  schemaVersion: "1.0.0",
  resort: {
    id: "CA_Golden_Kicking_Horse",
    name: "kicking horse",
    timezone: "America/Edmonton"
  },
  basemap: {
    pmtilesPath: "/packs/kh/base.pmtiles",
    stylePath: "/packs/kh/style.json"
  },
  thresholds: {
    liftProximityMeters: 150
  },
  lifts: [
    { id: "l1", name: "Lift 1", towers: [{ number: 1, coordinates: [0, 0] }] },
    { id: "l2", name: "Lift 2", towers: [{ number: 1, coordinates: [0, 0] }] }
  ],
  runs: [
    {
      id: "r1",
      name: "Run 1",
      difficulty: "blue",
      polygon: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
      centerline: { type: "LineString", coordinates: [[0, 0], [1, 1]] }
    }
  ]
};

describe("resort-page-model", () => {
  it("capitalizes resort names", () => {
    expect(capitalizeResortName("fernie alpine resort")).toBe("Fernie Alpine Resort");
    expect(capitalizeResortName("  kicking   horse ")).toBe("Kicking Horse");
  });

  it("builds header view model with counts and version", () => {
    expect(
      buildResortPageHeaderViewModel({
        resortName: "kicking horse",
        sourceVersion: "v4",
        pack: packFixture
      })
    ).toEqual({
      resortName: "Kicking Horse",
      versionText: "v4",
      runsCountText: "1 runs",
      liftsCountText: "2 lifts"
    });
  });

  it("falls back to pack resort name and unknown version", () => {
    const header = buildResortPageHeaderViewModel({
      resortName: "",
      pack: packFixture
    });
    expect(header.resortName).toBe("Kicking Horse");
    expect(header.versionText).toBe("v?");
  });

  it("builds full page view model", () => {
    const vm = buildResortPageViewModel({
      viewport: "medium",
      resortName: "kicking horse",
      sourceVersion: "v4",
      pack: packFixture,
      selectedTab: "my-location",
      panelOpen: false,
      fullscreenSupported: true,
      fullscreenActive: false
    });

    expect(vm.viewport).toBe("medium");
    expect(vm.selectedTab).toBe("my-location");
    expect(vm.panelOpen).toBe(false);
    expect(vm.header.runsCountText).toBe("1 runs");
  });
});
