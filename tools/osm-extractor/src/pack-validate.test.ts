import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizePack, summarizePackData, validatePack } from "../src/pack-validate.js";

const validFixturePath = resolve(process.cwd(), "../../src/resort-pack/fixtures/valid-pack.json");
const invalidFixturePath = resolve(process.cwd(), "../../src/resort-pack/fixtures/invalid-pack.json");

describe("pack validation", () => {
  it("accepts the current demo resort pack", () => {
    const fixture = JSON.parse(
      readFileSync(validFixturePath, "utf8")
    ) as unknown;

    const result = validatePack(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errors.join("\n"));
    }

    expect(summarizePack(result.value)).toContain("resort=Demo Resort");
    expect(summarizePackData(result.value)).toEqual({
      resortId: "demo-resort",
      resortName: "Demo Resort",
      schemaVersion: "1.0.0",
      counts: {
        runs: 1,
        lifts: 1,
        towers: 2
      }
    });
  });

  it("rejects invalid resort packs", () => {
    const fixture = JSON.parse(
      readFileSync(invalidFixturePath, "utf8")
    ) as unknown;

    const result = validatePack(fixture);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid pack");
    }

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => typeof issue.path === "string")).toBe(true);
  });

  it("returns entity references for run/lift scoped issues", () => {
    const fixture = {
      schemaVersion: "1.0.0",
      resort: { id: "demo", name: "Demo", timezone: "Europe/Rome" },
      basemap: { pmtilesPath: "packs/demo/base.pmtiles", stylePath: "packs/demo/style.json" },
      thresholds: { liftProximityMeters: 90 },
      lifts: [
        {
          id: "lift-a",
          name: "Lift A",
          towers: []
        }
      ],
      runs: [
        {
          id: "run-a",
          name: "Run A",
          difficulty: "blue",
          polygon: { type: "Polygon", coordinates: [] },
          centerline: { type: "LineString", coordinates: [] }
        }
      ]
    } as unknown;

    const result = validatePack(fixture);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid pack");
    }

    const runIssue = result.issues.find((issue) => issue.path.startsWith("/runs/0"));
    const liftIssue = result.issues.find((issue) => issue.path.startsWith("/lifts/0"));
    expect(runIssue?.entityRef).toBe("run:run-a");
    expect(liftIssue?.entityRef).toBe("lift:lift-a");
  });
});
