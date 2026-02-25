import { describe, expect, it } from "vitest";
import {
  resolveResortPanelLayoutMode,
  shouldUseMediumPortraitSheetLayout
} from "./resort-layout-mode";

describe("shouldUseMediumPortraitSheetLayout", () => {
  it("returns false outside medium viewport", () => {
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "small", widthPx: 390, heightPx: 844 })
    ).toBe(false);
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "large", widthPx: 1200, heightPx: 900 })
    ).toBe(false);
  });

  it("returns true for iPad-like medium portrait widths", () => {
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "medium", widthPx: 768, heightPx: 1024 })
    ).toBe(true);
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "medium", widthPx: 834, heightPx: 1194 })
    ).toBe(true);
  });

  it("returns false for medium landscape or out-of-band widths", () => {
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "medium", widthPx: 1023, heightPx: 768 })
    ).toBe(false);
    expect(
      shouldUseMediumPortraitSheetLayout({ viewport: "medium", widthPx: 900, heightPx: 1200 })
    ).toBe(false);
  });
});

describe("resolveResortPanelLayoutMode", () => {
  it("uses sheet for small", () => {
    expect(resolveResortPanelLayoutMode({ viewport: "small", widthPx: 390, heightPx: 844 })).toBe("sheet");
  });

  it("uses sheet for medium portrait ipad range and sidebar otherwise", () => {
    expect(resolveResortPanelLayoutMode({ viewport: "medium", widthPx: 768, heightPx: 1024 })).toBe("sheet");
    expect(resolveResortPanelLayoutMode({ viewport: "medium", widthPx: 900, heightPx: 1200 })).toBe("sidebar");
    expect(resolveResortPanelLayoutMode({ viewport: "medium", widthPx: 1023, heightPx: 768 })).toBe("sidebar");
  });

  it("uses sheet for short medium landscape phone-like heights", () => {
    expect(resolveResortPanelLayoutMode({ viewport: "medium", widthPx: 932, heightPx: 430 })).toBe("sheet");
    expect(resolveResortPanelLayoutMode({ viewport: "medium", widthPx: 844, heightPx: 390 })).toBe("sheet");
  });

  it("uses sidebar for large", () => {
    expect(resolveResortPanelLayoutMode({ viewport: "large", widthPx: 1280, heightPx: 800 })).toBe("sidebar");
  });

  it("rejects invalid dimensions", () => {
    expect(() =>
      resolveResortPanelLayoutMode({ viewport: "small", widthPx: 0, heightPx: 800 })
    ).toThrow(/Width must be a positive finite number/);
    expect(() =>
      resolveResortPanelLayoutMode({ viewport: "small", widthPx: 390, heightPx: Number.NaN })
    ).toThrow(/Height must be a positive finite number/);
  });
});
