import { describe, expect, it } from "vitest";
import { resolveUiAppRoute } from "./route";

describe("resolveUiAppRoute", () => {
  it("routes root path to v4 UI", () => {
    expect(resolveUiAppRoute("/", "/")).toBe("v4");
  });

  it("routes /new under root base to v4 UI", () => {
    expect(resolveUiAppRoute("/new", "/")).toBe("v4");
    expect(resolveUiAppRoute("/new/select", "/")).toBe("v4");
  });

  it("routes non-legacy root paths to v4 UI", () => {
    expect(resolveUiAppRoute("/select", "/")).toBe("v4");
  });

  it("routes /new under project pages base to v4 UI", () => {
    expect(resolveUiAppRoute("/Patrol-Toolkit/new", "/Patrol-Toolkit/")).toBe("v4");
    expect(resolveUiAppRoute("/Patrol-Toolkit/new/resort", "/Patrol-Toolkit/")).toBe("v4");
  });

  it("returns v4 even for paths outside BASE_URL (single-UI app cleanup)", () => {
    expect(resolveUiAppRoute("/other/new", "/Patrol-Toolkit/")).toBe("v4");
  });

  it("normalizes missing leading/trailing slashes", () => {
    expect(resolveUiAppRoute("Patrol-Toolkit/new", "Patrol-Toolkit")).toBe("v4");
  });

  it("treats /legacy as v4 after legacy UI removal", () => {
    expect(resolveUiAppRoute("/legacy", "/")).toBe("v4");
    expect(resolveUiAppRoute("/Patrol-Toolkit/legacy", "/Patrol-Toolkit/")).toBe("v4");
  });
});
