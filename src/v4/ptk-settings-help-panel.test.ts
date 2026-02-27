import { afterEach, describe, expect, it, vi } from "vitest";
import "./ptk-settings-help-panel";
import type { PtkSettingsHelpPanel } from "./ptk-settings-help-panel";

describe("ptk-settings-help-panel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides install app button when already installed", async () => {
    const element = createElement();
    element.isInstalled = true;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(buttonLabels(element)).not.toContain("Install App");
  });

  it("shows inline update action when target version exists", async () => {
    const element = createElement();
    element.appUpdateTargetVersion = "1.2.4";
    element.appUpdateSummary = "new version available";
    document.body.appendChild(element);
    await element.updateComplete;

    expect(buttonLabels(element)).toContain("Update the App");
    expect(readText(element)).toContain("new version available");
  });

  it("emits theme selection event", async () => {
    const element = createElement();
    const handler = vi.fn();
    element.addEventListener("ptk-settings-theme-select", handler);
    document.body.appendChild(element);
    await element.updateComplete;

    clickButton(element, "High contrast");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.theme).toBe("high-contrast");
  });

  it("renders pack update check action in offline resorts menu", async () => {
    const element = createElement();
    document.body.appendChild(element);
    await element.updateComplete;

    expect(buttonLabels(element)).toContain("Check pack updates");
  });

  it("emits install-pack-update when clicking update-available resort row", async () => {
    const element = createElement();
    const handler = vi.fn();
    element.addEventListener("ptk-settings-install-pack-update", handler);
    document.body.appendChild(element);
    await element.updateComplete;

    clickButton(element, "Fernie · v7");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.resortId).toBe("1");
  });
});

function createElement(): PtkSettingsHelpPanel {
  const element = document.createElement("ptk-settings-help-panel") as PtkSettingsHelpPanel;
  element.viewport = "small";
  element.appVersion = "1.2.3";
  element.theme = "default";
  element.installHint = "Install from browser menu.";
  element.offlineRows = [
    {
      resortId: "1",
      label: "Fernie · v7",
      badge: "Update available",
      badgeTone: "warning",
      action: "install-update",
      subtitle: "Download: 2.0 MiB"
    }
  ];
  element.packUpdateCandidates = [{ resortId: "1", resortName: "Fernie", version: "v8", selected: false }];
  return element;
}

function buttonLabels(element: PtkSettingsHelpPanel): string[] {
  return Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).map((node) =>
    ((node as HTMLElement).textContent ?? "").trim()
  );
}

function clickButton(element: PtkSettingsHelpPanel, label: string): void {
  const button = findButton(element, label);
  button.click();
}

function findButton(element: PtkSettingsHelpPanel, label: string): HTMLButtonElement {
  const button = Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

function readText(element: PtkSettingsHelpPanel): string {
  const root = element.shadowRoot;
  if (!root) {
    return "";
  }
  return (root.textContent ?? "").replace(/\s+/gu, " ").trim();
}
