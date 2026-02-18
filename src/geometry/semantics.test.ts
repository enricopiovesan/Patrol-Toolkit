import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { GeoLineString, ResortPack } from "../resort-pack/types";
import {
  classifyPositionBand,
  classifyPositionSemantics,
  classifySkierSide
} from "./semantics";

describe("position semantics", () => {
  const pack = structuredClone(validPack) as ResortPack;
  const run = pack.runs[0];

  it("classifies upper, mid, and lower by centerline fraction", () => {
    if (!run) {
      throw new Error("Missing run fixture");
    }

    const [start, end] = run.centerline.coordinates;
    if (!start || !end) {
      throw new Error("Missing centerline coordinates");
    }

    const upperPoint = interpolate(start, end, 0.1);
    const midPoint = interpolate(start, end, 0.5);
    const lowerPoint = interpolate(start, end, 0.9);

    expect(classifyPositionSemantics(upperPoint, run.centerline).positionBand).toBe("upper");
    expect(classifyPositionSemantics(midPoint, run.centerline).positionBand).toBe("mid");
    expect(classifyPositionSemantics(lowerPoint, run.centerline).positionBand).toBe("lower");
  });

  it("uses deterministic band thresholds at exact boundaries", () => {
    expect(classifyPositionBand(1 / 3)).toBe("mid");
    expect(classifyPositionBand(2 / 3)).toBe("lower");
  });

  it("classifies skier side using cross product", () => {
    const line: GeoLineString = {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0, 0.01]
      ]
    };

    const westPoint: [number, number] = [-0.001, 0.005];
    const eastPoint: [number, number] = [0.001, 0.005];
    const centerPoint: [number, number] = [0, 0.005];

    expect(classifySkierSide(westPoint, line)).toBe("left");
    expect(classifySkierSide(eastPoint, line)).toBe("right");
    expect(classifySkierSide(centerPoint, line)).toBe("center");
  });

  it("clamps fraction to start/end when point lies beyond line extents", () => {
    const line: GeoLineString = {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0, 0.01]
      ]
    };

    const beforeStart: [number, number] = [0, -0.002];
    const beyondEnd: [number, number] = [0, 0.02];

    const startSemantics = classifyPositionSemantics(beforeStart, line);
    const endSemantics = classifyPositionSemantics(beyondEnd, line);

    expect(startSemantics.fractionAlongRun).toBe(0);
    expect(startSemantics.positionBand).toBe("upper");
    expect(endSemantics.fractionAlongRun).toBe(1);
    expect(endSemantics.positionBand).toBe("lower");
  });
});

function interpolate(start: [number, number], end: [number, number], t: number): [number, number] {
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}
