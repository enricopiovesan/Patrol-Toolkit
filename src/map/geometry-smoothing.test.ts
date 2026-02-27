import { describe, expect, it } from "vitest";
import { smoothLineString, smoothPolygonRing } from "./geometry-smoothing";

describe("geometry smoothing", () => {
  it("smooths open line strings while preserving endpoints", () => {
    const input: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1]
    ];

    const output = smoothLineString(input, 2);
    expect(output.length).toBeGreaterThan(input.length);
    expect(output[0]).toEqual([0, 0]);
    expect(output[output.length - 1]).toEqual([2, 1]);
  });

  it("smooths closed polygon rings and keeps them closed", () => {
    const ring: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0]
    ];

    const output = smoothPolygonRing(ring, 3);
    expect(output.length).toBeGreaterThan(ring.length);
    expect(output[0]).toEqual(output[output.length - 1]);
  });
});
