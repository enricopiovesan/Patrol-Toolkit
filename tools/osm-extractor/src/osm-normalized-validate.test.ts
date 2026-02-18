import { describe, expect, it } from "vitest";
import { assertNormalizedResortSource } from "./osm-normalized-validate.js";

describe("assertNormalizedResortSource", () => {
  it("accepts a valid normalized source document", () => {
    const valid = {
      schemaVersion: "0.2.0",
      resort: { id: "demo", name: "Demo Resort" },
      source: {
        format: "osm-overpass-json",
        sha256: "abc123",
        inputPath: "demo.json",
        osmBaseTimestamp: null
      },
      boundary: null,
      lifts: [],
      runs: [],
      warnings: []
    };

    expect(() => assertNormalizedResortSource(valid)).not.toThrow();
  });

  it("throws with actionable details for invalid source data", () => {
    const invalid = {
      schemaVersion: "0.2.0",
      resort: { id: "", name: "Demo Resort" },
      source: {
        format: "osm-overpass-json",
        sha256: "abc123",
        inputPath: "demo.json",
        osmBaseTimestamp: null
      },
      boundary: null,
      lifts: [],
      runs: [],
      warnings: []
    };

    expect(() => assertNormalizedResortSource(invalid)).toThrow(/Invalid normalized OSM output/);
  });
});

