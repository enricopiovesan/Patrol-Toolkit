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

  it("keeps paths outside BASE_URL on legacy UI", () => {
    expect(resolveUiAppRoute("/other/new", "/Patrol-Toolkit/")).toBe("legacy");
  });

  it("normalizes missing leading/trailing slashes", () => {
    expect(resolveUiAppRoute("Patrol-Toolkit/new", "Patrol-Toolkit")).toBe("v4");
  });

  it("routes /legacy to legacy UI for rollback", () => {
    expect(resolveUiAppRoute("/legacy", "/")).toBe("legacy");
    expect(resolveUiAppRoute("/Patrol-Toolkit/legacy", "/Patrol-Toolkit/")).toBe("legacy");
  });
});
