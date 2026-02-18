import { describe, expect, it } from "vitest";
import { buildResortSearchUrl, searchResortCandidates } from "./resort-search.js";

describe("resort search", () => {
  it("builds a URL with country code filter when provided", () => {
    const url = new URL(buildResortSearchUrl({ name: "Kicking Horse", country: "CA", limit: 5 }));
    expect(url.hostname).toBe("nominatim.openstreetmap.org");
    expect(url.searchParams.get("q")).toBe("Kicking Horse, CA");
    expect(url.searchParams.get("countrycodes")).toBe("ca");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("maps and sorts valid candidates by importance", async () => {
    const result = await searchResortCandidates(
      { name: "Kicking Horse", country: "CA", limit: 5 },
      {
        fetchFn: (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => [
              {
                osm_type: "relation",
                osm_id: 2,
                display_name: "Resort B, Canada",
                lat: "51.20",
                lon: "-116.90",
                importance: 0.3,
                address: { country_code: "ca", country: "Canada", state: "British Columbia" }
              },
              {
                osm_type: "relation",
                osm_id: 1,
                display_name: "Resort A, Canada",
                lat: "51.30",
                lon: "-116.95",
                importance: 0.8,
                address: { country_code: "ca", country: "Canada", state: "British Columbia" }
              },
              {
                osm_type: "unknown",
                osm_id: 3,
                display_name: "Invalid",
                lat: "0",
                lon: "0"
              }
            ]
          }) as Response) as typeof fetch
      }
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.osmId).toBe(1);
    expect(result.candidates[0]?.center).toEqual([-116.95, 51.3]);
    expect(result.candidates[1]?.osmId).toBe(2);
  });

  it("throws on non-OK upstream response", async () => {
    await expect(
      searchResortCandidates(
        { name: "Kicking Horse", country: "CA", limit: 5 },
        {
          fetchFn: (async () =>
            ({
              ok: false,
              status: 429,
              json: async () => []
            }) as Response) as typeof fetch
        }
      )
    ).rejects.toThrow(/HTTP 429/);
  });
});
