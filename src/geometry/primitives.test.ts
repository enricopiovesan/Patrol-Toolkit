import { describe, expect, it } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import {
  distanceMetersBetween,
  findRunByContainmentOrNearestCenterline,
  isWithinThreshold,
  nearestPointOnLineString,
  nearestTower,
  pointInPolygon
} from "./primitives";

describe("geometry primitives", () => {
  const pack = structuredClone(validPack) as ResortPack;
  const run = pack.runs[0];
  const lift = pack.lifts[0];

  it("detects point inside run polygon", () => {
    if (!run) {
      throw new Error("Missing run fixture");
    }

    const inside: [number, number] = [-106.9502, 39.1928];
    const outside: [number, number] = [-106.9508, 39.1922];

    expect(pointInPolygon(inside, run.polygon)).toBe(true);
    expect(pointInPolygon(outside, run.polygon)).toBe(false);
  });

  it("treats polygon boundary points as inside", () => {
    if (!run) {
      throw new Error("Missing run fixture");
    }

    const vertex: [number, number] = [-106.95, 39.193];
    const edgeMidpoint: [number, number] = [-106.9505, 39.193];

    expect(pointInPolygon(vertex, run.polygon)).toBe(true);
    expect(pointInPolygon(edgeMidpoint, run.polygon)).toBe(true);
  });

  it("computes nearest point on centerline with segment index", () => {
    if (!run) {
      throw new Error("Missing run fixture");
    }

    const probe: [number, number] = [-106.9508, 39.1925];
    const nearest = nearestPointOnLineString(probe, run.centerline);

    expect(nearest.segmentIndex).toBe(0);
    expect(nearest.t).toBeGreaterThanOrEqual(0);
    expect(nearest.t).toBeLessThanOrEqual(1);
    expect(nearest.distanceMeters).toBeLessThan(40);
  });

  it("prefers containment over centerline fallback", () => {
    const insidePoint: [number, number] = [-106.9502, 39.1928];
    const result = findRunByContainmentOrNearestCenterline(insidePoint, pack.runs);

    expect(result?.method).toBe("containment");
    expect(result?.distanceMeters).toBe(0);
    expect(result?.run.id).toBe(run?.id);
  });

  it("falls back to nearest centerline when not contained", () => {
    const outsidePoint: [number, number] = [-106.9498, 39.1932];
    const result = findRunByContainmentOrNearestCenterline(outsidePoint, pack.runs);

    expect(result?.method).toBe("centerline");
    expect(result?.distanceMeters).toBeGreaterThan(0);
    expect(result?.run.id).toBe(run?.id);
  });

  it("finds nearest lift tower and applies threshold", () => {
    if (!lift) {
      throw new Error("Missing lift fixture");
    }

    const probe: [number, number] = [-106.95008, 39.19125];
    const nearest = nearestTower(probe, pack.lifts);

    expect(nearest?.liftId).toBe(lift.id);
    expect(nearest?.towerNumber).toBe(1);
    expect(nearest?.distanceMeters).toBeLessThan(20);
    expect(isWithinThreshold(nearest?.distanceMeters ?? Infinity, 30)).toBe(true);
    expect(isWithinThreshold(nearest?.distanceMeters ?? Infinity, 5)).toBe(false);
  });

  it("computes stable geodesic distance", () => {
    const a: [number, number] = [-106.9501, 39.1912];
    const b: [number, number] = [-106.9497, 39.1924];

    const distance = distanceMetersBetween(a, b);
    expect(distance).toBeGreaterThan(130);
    expect(distance).toBeLessThan(150);
  });
});
