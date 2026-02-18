import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { composeRadioPhrase } from "./phrase";

describe("composeRadioPhrase", () => {
  const pack = structuredClone(validPack) as ResortPack;

  it("composes full phrase with run, semantics, and tower when in threshold", () => {
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhrase(point, pack);

    expect(result.phrase).toBe("Easy Street, Mid, skier's left, below Summit Express tower 2");
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBe("lift-a");
  });

  it("omits tower segment when nearest tower is outside threshold", () => {
    const tightThresholdPack = structuredClone(pack);
    tightThresholdPack.thresholds.liftProximityMeters = 10;
    const point: [number, number] = [-106.9502, 39.1928];

    const result = composeRadioPhrase(point, tightThresholdPack);

    expect(result.phrase).toBe("Easy Street, Mid, skier's left");
    expect(result.runId).toBe("run-easy");
    expect(result.liftId).toBeNull();
  });

  it("falls back to tower-only phrase when run data is unavailable", () => {
    const noRunsPack = structuredClone(pack);
    noRunsPack.runs = [];
    const point: [number, number] = [-106.9501, 39.19123];

    const result = composeRadioPhrase(point, noRunsPack);

    expect(result.phrase).toBe("Near Summit Express tower 1");
    expect(result.runId).toBeNull();
    expect(result.liftId).toBe("lift-a");
  });

  it("returns deterministic unknown phrase when no run or lift is usable", () => {
    const emptyPack = structuredClone(pack);
    emptyPack.runs = [];
    emptyPack.lifts = [];
    const point: [number, number] = [-106.95, 39.1925];

    const result = composeRadioPhrase(point, emptyPack);

    expect(result.phrase).toBe("Location unknown");
    expect(result.runId).toBeNull();
    expect(result.liftId).toBeNull();
  });
});
