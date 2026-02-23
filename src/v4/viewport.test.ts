import { describe, expect, it } from "vitest";
import { classifyViewportWidth, VIEWPORT_BREAKPOINTS } from "./viewport";

describe("classifyViewportWidth", () => {
  it("classifies small widths", () => {
    expect(classifyViewportWidth(0)).toBe("small");
    expect(classifyViewportWidth(VIEWPORT_BREAKPOINTS.smallMaxExclusive - 1)).toBe("small");
  });

  it("classifies medium widths", () => {
    expect(classifyViewportWidth(VIEWPORT_BREAKPOINTS.smallMaxExclusive)).toBe("medium");
    expect(classifyViewportWidth(VIEWPORT_BREAKPOINTS.mediumMaxExclusive - 1)).toBe("medium");
  });

  it("classifies large widths", () => {
    expect(classifyViewportWidth(VIEWPORT_BREAKPOINTS.mediumMaxExclusive)).toBe("large");
    expect(classifyViewportWidth(1600)).toBe("large");
  });

  it("rejects invalid widths", () => {
    expect(() => classifyViewportWidth(-1)).toThrow(/non-negative finite number/iu);
    expect(() => classifyViewportWidth(Number.NaN)).toThrow(/non-negative finite number/iu);
    expect(() => classifyViewportWidth(Number.POSITIVE_INFINITY)).toThrow(/non-negative finite number/iu);
  });
});

