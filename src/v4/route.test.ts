import { describe, expect, it } from "vitest";
import { resolveUiAppRoute } from "./route";

describe("resolveUiAppRoute", () => {
  it("routes root path to v4 UI", () => {
    expect(resolveUiAppRoute("/", "/")).toBe("v4");
  });

  it("routes non-legacy root paths to v4 UI", () => {
    expect(resolveUiAppRoute("/select", "/")).toBe("v4");
  });

  it("returns v4 even for paths outside BASE_URL (single-UI app cleanup)", () => {
    expect(resolveUiAppRoute("/other/path", "/Patrol-Toolkit/")).toBe("v4");
  });

  it("normalizes missing leading/trailing slashes", () => {
    expect(resolveUiAppRoute("Patrol-Toolkit/select", "Patrol-Toolkit")).toBe("v4");
  });

  it("treats /legacy as v4 after legacy UI removal", () => {
    expect(resolveUiAppRoute("/legacy", "/")).toBe("v4");
    expect(resolveUiAppRoute("/Patrol-Toolkit/legacy", "/Patrol-Toolkit/")).toBe("v4");
  });
});
