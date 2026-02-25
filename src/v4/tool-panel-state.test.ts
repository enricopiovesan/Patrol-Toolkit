import { describe, expect, it } from "vitest";
import { createInitialToolPanelState } from "./tool-panel-state";

describe("createInitialToolPanelState", () => {
  it("uses fully visible bottom sheet on small", () => {
    expect(createInitialToolPanelState("small")).toEqual({
      presentation: "bottom-sheet",
      visibility: "visible",
      fullscreenSupported: true
    });
  });

  it("uses visible sidebar on medium", () => {
    expect(createInitialToolPanelState("medium")).toEqual({
      presentation: "sidebar",
      visibility: "visible",
      fullscreenSupported: true
    });
  });

  it("uses visible sidebar and enables fullscreen on large", () => {
    expect(createInitialToolPanelState("large")).toEqual({
      presentation: "sidebar",
      visibility: "visible",
      fullscreenSupported: true
    });
  });
});
