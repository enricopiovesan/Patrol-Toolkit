import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { composeRadioPhrase, composeRadioPhraseV2 } from "./phrase";

describe("composeRadioPhrase", () => {
  const pack = structuredClone(validPack) as ResortPack;

  it("composes full phrase with run, semantics, and tower when in threshold", () => {
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhrase(point, pack);

    expect(result.phrase).toContain("Easy Street");
    expect(result.phrase).toContain("middle section");
    expect(result.phrase).toMatch(/\d+m (above|below|from) Summit Express tower 2/iu);
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBe("lift-a");
  });

  it("omits tower segment when nearest tower is outside threshold", () => {
    const tightThresholdPack = structuredClone(pack);
    tightThresholdPack.thresholds.liftProximityMeters = 10;
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhrase(point, tightThresholdPack);

    expect(result.phrase).toBe("Easy Street, middle section");
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBeNull();
  });

  it("falls back to tower-only phrase when run data is unavailable", () => {
    const noRunsPack = structuredClone(pack);
    noRunsPack.runs = [];
    const point: [number, number] = [-106.9501, 39.19123];

    const result = composeRadioPhrase(point, noRunsPack);

    expect(result.phrase).toMatch(/\d+m from Summit Express tower 1/iu);
    expect(result.runId).toBeNull();
    expect(result.liftId).toBe("lift-a");
  });

  it("returns deterministic unknown phrase when no run or lift is usable", () => {
    const emptyPack = structuredClone(pack);
    emptyPack.runs = [];
    emptyPack.lifts = [];
    const point: [number, number] = [-106.95, 39.1925];

    const result = composeRadioPhrase(point, emptyPack);

    expect(result.phrase).toBe("Location uncertain");
    expect(result.runId).toBeNull();
    expect(result.liftId).toBeNull();
  });
});

describe("composeRadioPhraseV2", () => {
  const pack = structuredClone(validPack) as ResortPack;

  it("returns run+lift mode with high confidence when both run and nearby lift are available", () => {
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhraseV2(point, pack);

    expect(result.mode).toBe("run+lift");
    expect(result.confidence).toBe("high");
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBe("lift-a");
    expect(result.phrase).toContain("Easy Street");
    expect(result.phrase).toContain("middle section");
    expect(result.phrase).toMatch(/\d+m (above|below|from) Summit Express tower 2/iu);
  });

  it("returns run-only mode with medium confidence when tower is outside threshold and no run intersection anchor exists", () => {
    const tightThresholdPack = structuredClone(pack);
    tightThresholdPack.thresholds.liftProximityMeters = 10;
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhraseV2(point, tightThresholdPack);

    expect(result.mode).toBe("run-only");
    expect(result.confidence).toBe("medium");
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBeNull();
    expect(result.phrase).toBe("Easy Street, middle section");
  });

  it("uses run intersection anchor when lift anchor is unavailable", () => {
    const packWithIntersection: ResortPack = {
      ...structuredClone(pack),
      thresholds: {
        liftProximityMeters: 1
      },
      lifts: [],
      runs: [
        {
          id: "run-a",
          name: "It's a Ten",
          difficulty: "black",
          polygon: {
            type: "Polygon",
            coordinates: [[[-117.0, 51.3], [-116.998, 51.3], [-116.998, 51.298], [-117.0, 51.3]]]
          },
          centerline: {
            type: "LineString",
            coordinates: [
              [-117.0, 51.3],
              [-116.998, 51.298]
            ]
          }
        },
        {
          id: "run-b",
          name: "Crystal Bowl",
          difficulty: "blue",
          polygon: {
            type: "Polygon",
            coordinates: [[[-117.001, 51.299], [-116.997, 51.299], [-116.997, 51.297], [-117.001, 51.299]]]
          },
          centerline: {
            type: "LineString",
            coordinates: [
              [-117.0, 51.298],
              [-116.998, 51.3]
            ]
          }
        }
      ]
    };

    const point: [number, number] = [-116.9992, 51.2992];
    const result = composeRadioPhraseV2(point, packWithIntersection);

    expect(result.mode).toBe("run-only");
    expect(result.confidence).toBe("high");
    expect(result.runId).toBe("run-a");
    expect(result.liftId).toBeNull();
    expect(result.phrase).toContain("It's a Ten");
    expect(result.phrase).toMatch(/\d+m (north|south|east|west) from intersection with Crystal Bowl/iu);
  });

  it("returns lift-only mode with medium confidence when run data is unavailable", () => {
    const noRunsPack = structuredClone(pack);
    noRunsPack.runs = [];
    const point: [number, number] = [-106.9501, 39.19123];

    const result = composeRadioPhraseV2(point, noRunsPack);

    expect(result.mode).toBe("lift-only");
    expect(result.confidence).toBe("medium");
    expect(result.runId).toBeNull();
    expect(result.liftId).toBe("lift-a");
    expect(result.phrase).toMatch(/\d+m from Summit Express tower 1/iu);
  });

  it("returns fallback mode with low confidence when no run or lift is usable", () => {
    const emptyPack = structuredClone(pack);
    emptyPack.runs = [];
    emptyPack.lifts = [];
    const point: [number, number] = [-106.95, 39.1925];

    const result = composeRadioPhraseV2(point, emptyPack);

    expect(result.mode).toBe("fallback");
    expect(result.confidence).toBe("low");
    expect(result.runId).toBeNull();
    expect(result.liftId).toBeNull();
    expect(result.phrase).toBe("Location uncertain");
  });
});
