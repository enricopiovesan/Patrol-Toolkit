import { describe, expect, it } from "vitest";
import { normalizeV4Theme } from "./theme";

describe("normalizeV4Theme", () => {
  it("defaults unknown values to default", () => {
    expect(normalizeV4Theme(undefined)).toBe("default");
    expect(normalizeV4Theme(null)).toBe("default");
    expect(normalizeV4Theme("")).toBe("default");
    expect(normalizeV4Theme("dark")).toBe("default");
  });

  it("accepts high-contrast and normalizes case", () => {
    expect(normalizeV4Theme("high-contrast")).toBe("high-contrast");
    expect(normalizeV4Theme("HIGH-CONTRAST")).toBe("high-contrast");
  });
});

