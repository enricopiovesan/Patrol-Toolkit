import { describe, expect, it } from "vitest";
import { resolveContourOverlayConfig } from "./contour-overlay";

describe("resolveContourOverlayConfig", () => {
  it("returns null when contour tiles url is missing", () => {
    expect(resolveContourOverlayConfig({})).toBeNull();
  });

  it("returns null when contour tiles url is not a tile template", () => {
    expect(resolveContourOverlayConfig({ VITE_CONTOUR_TILES_URL: "https://example.com/contours.png" })).toBeNull();
  });

  it("builds raster contour overlay config from env", () => {
    const result = resolveContourOverlayConfig({
      VITE_CONTOUR_TILES_URL: "https://example.com/tiles/{z}/{x}/{y}.png",
      VITE_CONTOUR_ATTRIBUTION: "© Demo contours",
      VITE_CONTOUR_TILE_SIZE: "512",
      VITE_CONTOUR_MIN_ZOOM: "11",
      VITE_CONTOUR_MAX_ZOOM: "17",
      VITE_CONTOUR_OPACITY: "0.75"
    });

    expect(result).not.toBeNull();
    expect(result?.source).toEqual({
      type: "raster",
      tiles: ["https://example.com/tiles/{z}/{x}/{y}.png"],
      tileSize: 512,
      attribution: "© Demo contours",
      minzoom: 11,
      maxzoom: 17
    });
    expect(result?.layer).toEqual({
      id: "ptk-contour-overlay-raster",
      type: "raster",
      source: "ptk-contour-overlay",
      minzoom: 11,
      maxzoom: 17,
      paint: {
        "raster-opacity": 0.75
      }
    });
  });

  it("clamps invalid numeric values to safe ranges", () => {
    const result = resolveContourOverlayConfig({
      VITE_CONTOUR_TILES_URL: "https://example.com/tiles/{z}/{x}/{y}.png",
      VITE_CONTOUR_TILE_SIZE: "2048",
      VITE_CONTOUR_MIN_ZOOM: "-3",
      VITE_CONTOUR_MAX_ZOOM: "99",
      VITE_CONTOUR_OPACITY: "3"
    });

    expect(result?.source.tileSize).toBe(512);
    expect(result?.source.minzoom).toBe(0);
    expect(result?.source.maxzoom).toBe(22);
    expect(result?.layer.paint).toEqual({ "raster-opacity": 1 });
  });

  it("uses defaults when optional config is not provided", () => {
    const result = resolveContourOverlayConfig({
      VITE_CONTOUR_TILES_URL: "https://example.com/tiles/{z}/{x}/{y}.png"
    });

    expect(result?.source.attribution).toBe("Contour data source");
    expect(result?.source.tileSize).toBe(256);
    expect(result?.source.minzoom).toBe(12);
    expect(result?.source.maxzoom).toBe(16);
    expect(result?.layer.paint).toEqual({ "raster-opacity": 0.6 });
  });

  it("ensures max zoom is not below min zoom", () => {
    const result = resolveContourOverlayConfig({
      VITE_CONTOUR_TILES_URL: "https://example.com/tiles/{z}/{x}/{y}.png",
      VITE_CONTOUR_MIN_ZOOM: "15",
      VITE_CONTOUR_MAX_ZOOM: "12"
    });

    expect(result?.source.minzoom).toBe(15);
    expect(result?.source.maxzoom).toBe(15);
  });
});

