import { describe, expect, it } from "vitest";
import { readAerialConfigFromEnv } from "./aerial-config";

describe("readAerialConfigFromEnv", () => {
  it("disables aerial when provider is missing", () => {
    expect(readAerialConfigFromEnv({})).toEqual({
      enabled: false,
      provider: null,
      reason: "missing-provider"
    });
  });

  it("disables aerial when provider is unsupported", () => {
    expect(readAerialConfigFromEnv({ VITE_AERIAL_PROVIDER: "foo" })).toEqual({
      enabled: false,
      provider: null,
      reason: "unsupported-provider"
    });
  });

  it("disables aerial when maptiler key is missing", () => {
    expect(readAerialConfigFromEnv({ VITE_AERIAL_PROVIDER: "maptiler" })).toEqual({
      enabled: false,
      provider: null,
      reason: "missing-key"
    });
  });

  it("returns maptiler tile config when provider and key are set", () => {
    const config = readAerialConfigFromEnv({
      VITE_AERIAL_PROVIDER: "maptiler",
      VITE_MAPTILER_KEY: "abc123"
    });
    expect(config.enabled).toBe(true);
    if (!config.enabled) {
      return;
    }
    expect(config.provider).toBe("maptiler");
    expect(config.tileUrlTemplate).toContain("api.maptiler.com/tiles/satellite-v2");
    expect(config.tileUrlTemplate).toContain("key=abc123");
  });
});

