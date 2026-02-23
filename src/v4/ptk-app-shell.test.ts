import { afterEach, describe, expect, it } from "vitest";
import "./ptk-app-shell";
import type { PtkAppShell } from "./ptk-app-shell";
import { V4_THEME_STORAGE_KEY } from "./theme-preferences";

describe("ptk-app-shell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.localStorage.clear();
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

  it("switches theme at runtime and persists selection", async () => {
    setWindowWidth(1024);
    const element = document.createElement("ptk-app-shell") as PtkAppShell;
    document.body.appendChild(element);
    await element.updateComplete;

    const host = element.shadowRoot?.querySelector(".root");
    expect(host?.getAttribute("data-theme")).toBe("default");

    const button = Array.from(element.shadowRoot?.querySelectorAll(".theme-segmented button") ?? []).find(
      (node) => (node.textContent ?? "").includes("High contrast")
    ) as HTMLButtonElement | undefined;
    if (!button) {
      throw new Error("High contrast theme button not found.");
    }
    button.click();
    await element.updateComplete;

    expect(host?.getAttribute("data-theme")).toBe("high-contrast");
    expect(window.localStorage.getItem(V4_THEME_STORAGE_KEY)).toBe("high-contrast");
  });

  it("restores theme from localStorage on startup", async () => {
    window.localStorage.setItem(V4_THEME_STORAGE_KEY, "high-contrast");
    setWindowWidth(1280);
    const element = document.createElement("ptk-app-shell") as PtkAppShell;
    document.body.appendChild(element);
    await element.updateComplete;

    const host = element.shadowRoot?.querySelector(".root");
    expect(host?.getAttribute("data-theme")).toBe("high-contrast");
    expect(readMeta(element)).toContain("theme=high-contrast");
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
