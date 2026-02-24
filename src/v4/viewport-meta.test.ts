import { describe, expect, it } from "vitest";
import { computeViewportMetaContent, syncViewportMeta } from "./viewport-meta";

describe("computeViewportMetaContent", () => {
  it("locks zoom on default v4 route for small and medium", () => {
    expect(computeViewportMetaContent("/", "/", 390)).toContain("user-scalable=no");
    expect(computeViewportMetaContent("/", "/", 900)).toContain("user-scalable=no");
  });

  it("locks zoom on /new for small and medium", () => {
    expect(computeViewportMetaContent("/new", "/", 390)).toContain("user-scalable=no");
    expect(computeViewportMetaContent("/new", "/", 900)).toContain("user-scalable=no");
  });

  it("does not lock zoom on v4 routes for large", () => {
    expect(computeViewportMetaContent("/", "/", 1200)).toBe("width=device-width, initial-scale=1.0");
    expect(computeViewportMetaContent("/new", "/", 1200)).toBe("width=device-width, initial-scale=1.0");
  });

  it("supports project pages subpath routing", () => {
    expect(computeViewportMetaContent("/Patrol-Toolkit/", "/Patrol-Toolkit/", 500)).toContain(
      "user-scalable=no"
    );
    expect(computeViewportMetaContent("/Patrol-Toolkit/new", "/Patrol-Toolkit/", 500)).toContain(
      "user-scalable=no"
    );
  });

  it("uses default viewport meta on rollback /legacy route", () => {
    expect(computeViewportMetaContent("/legacy", "/", 390)).toBe("width=device-width, initial-scale=1.0");
  });
});

describe("syncViewportMeta", () => {
  it("updates existing viewport meta element", () => {
    const doc = document.implementation.createHTMLDocument("test");
    const meta = doc.createElement("meta");
    meta.setAttribute("name", "viewport");
    meta.setAttribute("content", "width=device-width, initial-scale=1.0");
    doc.head.appendChild(meta);

    const result = syncViewportMeta(doc, "/new", "/", 430);
    expect(result).toContain("user-scalable=no");
    expect(meta.getAttribute("content")).toBe(result);
  });
});
