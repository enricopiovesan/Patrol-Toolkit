import { describe, expect, it } from "vitest";
import { mountRootShell, selectRootShellTag } from "./bootstrap";

describe("selectRootShellTag", () => {
  it("selects legacy shell for non-/new routes", () => {
    expect(selectRootShellTag("/", "/")).toBe("app-shell");
    expect(selectRootShellTag("/Patrol-Toolkit/", "/Patrol-Toolkit/")).toBe("app-shell");
  });

  it("selects v4 shell for /new routes", () => {
    expect(selectRootShellTag("/new", "/")).toBe("ptk-app-shell");
    expect(selectRootShellTag("/Patrol-Toolkit/new", "/Patrol-Toolkit/")).toBe("ptk-app-shell");
  });
});

describe("mountRootShell", () => {
  it("replaces legacy shell with v4 shell when route is /new", () => {
    const doc = document.implementation.createHTMLDocument("test");
    doc.body.innerHTML = "<app-shell></app-shell>";

    const tag = mountRootShell(doc, "/new", "/");

    expect(tag).toBe("ptk-app-shell");
    expect(doc.querySelector("ptk-app-shell")).not.toBeNull();
    expect(doc.querySelector("app-shell")).toBeNull();
  });

  it("keeps existing matching shell without replacement", () => {
    const doc = document.implementation.createHTMLDocument("test");
    const existing = doc.createElement("ptk-app-shell");
    doc.body.appendChild(existing);

    const tag = mountRootShell(doc, "/new", "/");

    expect(tag).toBe("ptk-app-shell");
    expect(doc.querySelector("ptk-app-shell")).toBe(existing);
  });
});

