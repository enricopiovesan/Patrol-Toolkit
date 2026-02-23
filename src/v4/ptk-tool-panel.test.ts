import { afterEach, describe, expect, it } from "vitest";
import "./ptk-tool-panel";
import type { PtkToolPanel } from "./ptk-tool-panel";

describe("ptk-tool-panel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders bottom sheet presentation for small viewport", async () => {
    const element = document.createElement("ptk-tool-panel") as PtkToolPanel;
    element.viewport = "small";
    element.open = true;
    document.body.appendChild(element);
    await element.updateComplete;

    const panel = element.shadowRoot?.querySelector(".panel");
    expect(panel?.className).toContain("small");
    expect(panel?.getAttribute("aria-hidden")).toBe("false");
  });

  it("hides panel when open is false", async () => {
    const element = document.createElement("ptk-tool-panel") as PtkToolPanel;
    element.viewport = "medium";
    element.open = false;
    document.body.appendChild(element);
    await element.updateComplete;

    const panel = element.shadowRoot?.querySelector(".panel");
    expect(panel?.className).toContain("hidden");
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
  });
});

