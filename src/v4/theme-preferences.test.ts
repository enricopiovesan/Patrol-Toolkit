import { describe, expect, it, vi } from "vitest";
import { readStoredV4Theme, V4_THEME_STORAGE_KEY, writeStoredV4Theme } from "./theme-preferences";

describe("theme preferences", () => {
  it("reads normalized stored theme", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("HIGH-CONTRAST")
    };
    expect(readStoredV4Theme(storage)).toBe("high-contrast");
    expect(storage.getItem).toHaveBeenCalledWith(V4_THEME_STORAGE_KEY);
  });

  it("falls back to default on missing or invalid values", () => {
    expect(readStoredV4Theme(null)).toBe("default");
    expect(
      readStoredV4Theme({
        getItem: () => "neon"
      })
    ).toBe("default");
  });

  it("falls back to default when storage read throws", () => {
    expect(
      readStoredV4Theme({
        getItem: () => {
          throw new Error("blocked");
        }
      })
    ).toBe("default");
  });

  it("writes theme using stable storage key", () => {
    const storage = {
      setItem: vi.fn()
    };
    writeStoredV4Theme(storage, "high-contrast");
    expect(storage.setItem).toHaveBeenCalledWith(V4_THEME_STORAGE_KEY, "high-contrast");
  });

  it("swallows storage write errors", () => {
    expect(() =>
      writeStoredV4Theme(
        {
          setItem: () => {
            throw new Error("quota");
          }
        },
        "default"
      )
    ).not.toThrow();
  });
});

