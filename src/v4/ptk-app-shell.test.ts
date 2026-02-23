import { afterEach, describe, expect, it } from "vitest";
import "./ptk-app-shell";
import type { PtkAppShell } from "./ptk-app-shell";

describe("ptk-app-shell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders v4 shell foundation header", async () => {
    setWindowWidth(1200);
    const element = document.createElement("ptk-app-shell") as PtkAppShell;
    document.body.appendChild(element);
    await element.updateComplete;

    const title = element.shadowRoot?.querySelector(".title")?.textContent ?? "";
    expect(title).toContain("Patrol Toolkit /new");
  });

  it("shows small viewport panel and fullscreen control", async () => {
    setWindowWidth(430);
    const element = document.createElement("ptk-app-shell") as PtkAppShell;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(readMeta(element)).toContain("viewport=small");
    expect(readMeta(element)).toContain("panel=bottom-sheet");
    expect(listButtons(element)).toContain("Full screen");
  });

  it("hides fullscreen control on large viewport", async () => {
    setWindowWidth(1280);
    const element = document.createElement("ptk-app-shell") as PtkAppShell;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(readMeta(element)).toContain("viewport=large");
    expect(readMeta(element)).toContain("fullscreen=no");
    expect(listButtons(element)).not.toContain("Full screen");
  });
});

function setWindowWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
}

function readMeta(element: PtkAppShell): string {
  return Array.from(element.shadowRoot?.querySelectorAll(".chip") ?? [])
    .map((node) => node.textContent ?? "")
    .join(" | ");
}

function listButtons(element: PtkAppShell): string[] {
  return Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).map(
    (node) => (node.textContent ?? "").trim()
  );
}

