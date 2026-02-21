import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./base-url";

describe("resolveAppUrl", () => {
  it("resolves leading-slash paths under BASE_URL", () => {
    expect(resolveAppUrl("/packs/demo.json")).toBe("/packs/demo.json");
  });

  it("resolves relative paths under BASE_URL", () => {
    expect(resolveAppUrl("packs/demo.json")).toBe("/packs/demo.json");
  });

  it("keeps network URLs unchanged", () => {
    expect(resolveAppUrl("https://example.com/data.json")).toBe("https://example.com/data.json");
  });
});
