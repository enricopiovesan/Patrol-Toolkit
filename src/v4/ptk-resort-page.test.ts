import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PtkResortPage } from "./ptk-resort-page";

describe("ptk-resort-page", () => {
  beforeEach(async () => {
    ensureCreateObjectUrlPolyfill();
    await import("./ptk-resort-page");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders header counts and tabs", async () => {
    const element = createElement();
    document.body.appendChild(element);
    await element.updateComplete;

    const header = element.shadowRoot?.querySelector("ptk-page-header") as
      | (HTMLElement & {
          title?: string;
          subtitle?: string;
          metaLine1?: string;
          metaLine2?: string;
        })
      | null;
    expect(header?.title).toBe("Kicking Horse");
    expect(header?.metaLine1).toBe("231 runs");
    expect(header?.metaLine2).toBe("3 lifts");

    const text = readText(element);
    expect(text).toContain("My location");
    expect(text).toContain("Runs Check");
    expect(text).toContain("Sweeps");
    expect(element.shadowRoot?.querySelector(".map-test-surface")).toBeTruthy();
  });

  it("hides fullscreen control on large when unsupported", async () => {
    const element = createElement();
    element.viewport = "large";
    element.fullscreenSupported = false;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(readButtons(element)).not.toContain("Full screen");
  });

  it("shows sweeps intentional temporary roadmap message", async () => {
    const element = createElement();
    element.selectedTab = "sweeps";
    document.body.appendChild(element);
    await element.updateComplete;

    expect(readText(element)).toContain("Not defined yet");
    expect(readText(element)).toContain("roadmap");
  });

  it("emits tab select event", async () => {
    const element = createElement();
    const handler = vi.fn();
    element.addEventListener("ptk-resort-tab-select", handler);
    document.body.appendChild(element);
    await element.updateComplete;

    clickButton(element, "Runs Check");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.tabId).toBe("runs-check");
  });

  it("renders gps guidance modal and emits retry/dismiss events", async () => {
    const element = createElement();
    element.gpsDisabled = true;
    element.gpsStatusText = "Location permission denied.";
    element.gpsGuidanceModalOpen = true;
    element.gpsGuidanceBody = "Re-enable location access in browser settings.";
    const retryHandler = vi.fn();
    const dismissHandler = vi.fn();
    element.addEventListener("ptk-resort-gps-retry", retryHandler);
    element.addEventListener("ptk-resort-gps-guidance-dismiss", dismissHandler);
    document.body.appendChild(element);
    await element.updateComplete;

    expect(readText(element)).toContain("Turn On Location");
    expect(readText(element)).toContain("Re-enable location access");

    clickButton(element, "Turn On Location");
    expect(retryHandler).toHaveBeenCalledTimes(1);

    clickButton(element, "Close");
    expect(dismissHandler).toHaveBeenCalledTimes(1);
  });
});

function createElement(): PtkResortPage {
  const element = document.createElement("ptk-resort-page") as PtkResortPage;
  element.header = {
    resortName: "Kicking Horse",
    versionText: "v4",
    runsCountText: "231 runs",
    liftsCountText: "3 lifts"
  };
  element.viewport = "small";
  element.selectedTab = "my-location";
  element.panelOpen = true;
  element.fullscreenSupported = true;
  element.fullscreenActive = false;
  element.renderLiveMap = false;
  return element;
}

function readText(element: PtkResortPage): string {
  const root = element.shadowRoot;
  if (!root) {
    return "";
  }
  const styleNodes = Array.from(root.querySelectorAll("style"));
  const previous = styleNodes.map((node) => node.textContent);
  styleNodes.forEach((node) => (node.textContent = ""));
  const text = (root.textContent ?? "").replace(/\s+/gu, " ").trim();
  styleNodes.forEach((node, index) => (node.textContent = previous[index] ?? ""));
  return text;
}

function ensureCreateObjectUrlPolyfill(): void {
  const urlObject = window.URL as typeof window.URL & { createObjectURL?: (value: Blob) => string };
  if (typeof urlObject.createObjectURL !== "function") {
    urlObject.createObjectURL = () => "blob:mock";
  }
}

function readButtons(element: PtkResortPage): string[] {
  return Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).map((node) =>
    ((node as HTMLElement).textContent ?? "").trim()
  );
}

function clickButton(element: PtkResortPage, label: string): void {
  const button = Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  button.click();
}
