import { describe, expect, it } from "vitest";
import { mountRootShell, selectRootShellTag } from "./bootstrap";

describe("selectRootShellTag", () => {
  it("selects v4 shell for default routes", () => {
    expect(selectRootShellTag("/", "/")).toBe("ptk-app-shell");
    expect(selectRootShellTag("/Patrol-Toolkit/", "/Patrol-Toolkit/")).toBe("ptk-app-shell");
  });

  it("keeps v4 shell for /legacy after legacy UI removal", () => {
    expect(selectRootShellTag("/legacy", "/")).toBe("ptk-app-shell");
    expect(selectRootShellTag("/Patrol-Toolkit/legacy", "/Patrol-Toolkit/")).toBe("ptk-app-shell");
  });
});

describe("mountRootShell", () => {
  it("replaces legacy shell with v4 shell on default route", () => {
    const doc = document.implementation.createHTMLDocument("test");
    doc.body.innerHTML = "<app-shell></app-shell>";

    const tag = mountRootShell(doc, "/", "/");

    expect(tag).toBe("ptk-app-shell");
    expect(doc.querySelector("ptk-app-shell")).not.toBeNull();
    expect(doc.querySelector("app-shell")).toBeNull();
  });

  it("keeps existing matching shell without replacement", () => {
    const doc = document.implementation.createHTMLDocument("test");
    const existing = doc.createElement("ptk-app-shell");
    doc.body.appendChild(existing);

    const tag = mountRootShell(doc, "/", "/");

    expect(tag).toBe("ptk-app-shell");
    expect(doc.querySelector("ptk-app-shell")).toBe(existing);
  });

  it("replaces any existing root element with v4 shell", () => {
    const doc = document.implementation.createHTMLDocument("test");
    doc.body.innerHTML = "<div id='legacy-root'></div>";

    const tag = mountRootShell(doc, "/legacy", "/");

    expect(tag).toBe("ptk-app-shell");
    expect(doc.querySelector("ptk-app-shell")).not.toBeNull();
    expect(doc.querySelector("#legacy-root")).toBeNull();
  });
});
