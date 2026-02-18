import { describe, expect, it } from "vitest";
import validPack from "./fixtures/valid-pack.json";
import { assertResortPack, loadResortPackFromJson } from "./loader";

describe("resort pack loader", () => {
  it("loads and validates JSON payload", () => {
    const payload = JSON.stringify(validPack);
    const result = loadResortPackFromJson(payload);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected load success");
    }

    expect(result.value.basemap.pmtilesPath).toContain(".pmtiles");
  });

  it("reports invalid JSON payload", () => {
    const result = loadResortPackFromJson("not-json");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected load failure");
    }

    expect(result.errors[0]?.code).toBe("invalid_json");
    expect(result.errors[0]?.message).toBe("Invalid JSON.");
  });

  it("throws from assertResortPack with validation details", () => {
    expect(() => assertResortPack({ schemaVersion: "1.0.0" })).toThrow(
      /Invalid Resort Pack/
    );
  });
});
