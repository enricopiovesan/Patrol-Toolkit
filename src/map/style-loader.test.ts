import { describe, expect, it, vi } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "../resort-pack/types";
import { OFFLINE_FALLBACK_STYLE, resolveStyleForPack } from "./style-loader";

describe("resolveStyleForPack", () => {
  it("returns offline fallback when pack is null", async () => {
    const result = await resolveStyleForPack(null);
    expect(result.key).toBe("fallback");
    expect(result.style).toEqual(OFFLINE_FALLBACK_STYLE);
  });

  it("loads style json from local style path", async () => {
    const pack = structuredClone(validPack) as ResortPack;
    pack.basemap.stylePath = "packs/demo/style.json";

    const stylePayload = {
      version: 8,
      sources: {
        basemap: {
          type: "vector",
          url: "packs/demo/base.pmtiles"
        }
      },
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#fff" } }]
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(stylePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await resolveStyleForPack(pack, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith("/packs/demo/style.json");
    expect(result.key).toBe("pack:demo-resort:/packs/demo/style.json");
    expect(result.style).toEqual({
      ...stylePayload,
      sources: {
        basemap: {
          type: "vector",
          url: "pmtiles:///packs/demo/base.pmtiles"
        }
      }
    });
  });

  it("returns fallback when style path is remote", async () => {
    const pack = structuredClone(validPack) as ResortPack;
    pack.basemap.stylePath = "https://example.com/style.json";

    const fetchMock = vi.fn();
    const result = await resolveStyleForPack(pack, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.key).toBe("fallback:demo-resort");
    expect(result.style).toEqual(OFFLINE_FALLBACK_STYLE);
  });

  it("injects pack pmtiles path when vector source has no url", async () => {
    const pack = structuredClone(validPack) as ResortPack;
    pack.basemap.stylePath = "packs/demo/style.json";
    pack.basemap.pmtilesPath = "packs/demo/custom.pmtiles";

    const stylePayload = {
      version: 8,
      sources: {
        basemap: {
          type: "vector"
        }
      },
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#fff" } }]
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(stylePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await resolveStyleForPack(pack, fetchMock);
    expect(result.style).toEqual({
      ...stylePayload,
      sources: {
        basemap: {
          type: "vector",
          url: "pmtiles:///packs/demo/custom.pmtiles"
        }
      }
    });
  });
});
