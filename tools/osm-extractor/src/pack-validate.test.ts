import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizePack, validatePack } from "../src/pack-validate.js";

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
  });
});
