import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNominatimLookupUrl, buildWinterSportsOverpassQuery, detectResortBoundaryCandidates } from "./resort-boundary-detect.js";

describe("resort boundary detect", () => {
  it("builds lookup URL with encoded OSM id", () => {
    const url = new URL(buildNominatimLookupUrl({ osmType: "relation", osmId: 123 }));
    expect(url.pathname).toBe("/lookup");
    expect(url.searchParams.get("osm_ids")).toBe("R123");
    expect(url.searchParams.get("polygon_geojson")).toBe("1");
  });

  it("builds winter sports area overpass query", () => {
    const query = buildWinterSportsOverpassQuery({
      minLon: -117.1,
      minLat: 51.2,
      maxLon: -116.8,
      maxLat: 51.5,
      timeoutSeconds: 30
    });
    expect(query).toMatch(/way\["landuse"="winter_sports"\]/);
    expect(query).toMatch(/relation\["landuse"="winter_sports"\]/);
    expect(query).toMatch(/way\["leisure"="ski_resort"\]/);
    expect(query).toMatch(/relation\["leisure"="ski_resort"\]/);
    expect(query).toMatch(/\[timeout:30\]/);
  });

  it("ranks candidates and validates geometry coverage", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-detect-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" },
            selection: {
              osmType: "relation",
              osmId: 100,
              displayName: "Selected Resort",
              center: [-116.95, 51.3],
              selectedAt: "2026-02-18T10:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 3 },
        {
          searchFn: async () => ({
            query: { name: "Kicking Horse", country: "CA", limit: 3 },
            candidates: [
              {
                osmType: "relation",
                osmId: 200,
                displayName: "Alternative Resort",
                center: [-117.3, 51.8],
                countryCode: "ca",
                country: "Canada",
                region: "British Columbia",
                importance: 0.4,
                source: "nominatim"
              }
            ]
          }),
          fetchFn: (async (input: unknown) => {
            const url = String(input);
            if (url.includes("R100")) {
              return {
                ok: true,
                status: 200,
                json: async () => [
                  {
                    display_name: "Selected Resort Boundary",
                    lat: "51.3",
                    lon: "-116.95",
                    geojson: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [-117.0, 51.2],
                          [-116.8, 51.2],
                          [-116.8, 51.4],
                          [-117.0, 51.4],
                          [-117.0, 51.2]
                        ]
                      ]
                    }
                  }
                ]
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Alternative Boundary",
                  lat: "51.8",
                  lon: "-117.3",
                  geojson: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [-117.4, 51.7],
                        [-117.2, 51.7],
                        [-117.2, 51.9],
                        [-117.4, 51.9],
                        [-117.4, 51.7]
                      ]
                    ]
                  }
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0]?.osmId).toBe(100);
      expect(result.candidates[0]?.validation.containsSelectionCenter).toBe(true);
      expect(result.candidates[0]?.validation.signals).toContain("contains-selection-center");
      expect(result.candidates[0]?.validation.distanceToSelectionCenterKm).toBeLessThan(1);
      expect(result.candidates[1]?.validation.containsSelectionCenter).toBe(false);
      expect(result.candidates[1]?.validation.issues.join(" ")).toMatch(/outside candidate boundary/i);
      expect(result.candidates[1]?.validation.distanceToSelectionCenterKm).toBeGreaterThan(25);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("fails when workspace has no selected resort", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-no-selection-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      await expect(detectResortBoundaryCandidates({ workspacePath, searchLimit: 3 })).rejects.toThrow(
        /no selected resort/i
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("prioritizes winter sports polygon candidates over non-polygon node selection", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-winter-sports-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 7248641928,
              displayName: "Kicking Horse POI",
              center: [-116.96246, 51.29371],
              selectedAt: "2026-02-18T10:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 2 },
        {
          searchFn: async () => ({
            query: { name: "Kicking Horse", country: "CA", limit: 2 },
            candidates: []
          }),
          fetchFn: (async (input: unknown) => {
            const url = String(input);
            if (url.includes("overpass-api.de/api/interpreter")) {
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  elements: [
                    {
                      type: "way",
                      id: 999,
                      tags: {
                        landuse: "winter_sports",
                        name: "Kicking Horse Winter Sports Area"
                      },
                      geometry: [
                        { lon: -117.0, lat: 51.2 },
                        { lon: -116.8, lat: 51.2 },
                        { lon: -116.8, lat: 51.4 },
                        { lon: -117.0, lat: 51.4 },
                        { lon: -117.0, lat: 51.2 }
                      ]
                    }
                  ]
                })
              } as Response;
            }
            if (url.includes("W999")) {
              return {
                ok: true,
                status: 200,
                json: async () => [
                  {
                    display_name: "Kicking Horse Winter Sports Area",
                    lat: "51.29371",
                    lon: "-116.96246",
                    geojson: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [-117.0, 51.2],
                          [-116.8, 51.2],
                          [-116.8, 51.4],
                          [-117.0, 51.4],
                          [-117.0, 51.2]
                        ]
                      ]
                    }
                  }
                ]
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Kicking Horse POI",
                  lat: "51.29371",
                  lon: "-116.96246"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0]?.osmType).toBe("way");
      expect(result.candidates[0]?.osmId).toBe(999);
      expect(result.candidates[0]?.ring).not.toBeNull();
      expect(result.candidates[0]?.validation.containsSelectionCenter).toBe(true);
      expect(result.candidates[0]?.validation.signals).toContain("winter-sports-name");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("penalizes nearby boundaries with non-matching resort names (Nakiska vs Fortress)", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-name-mismatch-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Nakiska Ski Area", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 111,
              displayName: "Nakiska Ski Area",
              center: [-115.173, 50.948],
              selectedAt: "2026-02-21T00:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 2 },
        {
          searchFn: async () => ({
            query: { name: "Nakiska Ski Area", country: "CA", limit: 2 },
            candidates: [
              {
                osmType: "way",
                osmId: 2001,
                displayName: "Fortress Mountain Resort",
                center: [-115.26, 50.99],
                countryCode: "ca",
                country: "Canada",
                region: "Alberta",
                importance: 0.7,
                source: "nominatim"
              },
              {
                osmType: "way",
                osmId: 2002,
                displayName: "Nakiska Ski Area",
                center: [-115.18, 50.95],
                countryCode: "ca",
                country: "Canada",
                region: "Alberta",
                importance: 0.7,
                source: "nominatim"
              }
            ]
          }),
          fetchFn: (async (input: unknown) => {
            const url = String(input);
            if (url.includes("W2001")) {
              return {
                ok: true,
                status: 200,
                json: async () => [
                  {
                    display_name: "Fortress Mountain Resort, Alberta, Canada",
                    lat: "50.9900",
                    lon: "-115.2600",
                    geojson: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [-115.27, 50.98],
                          [-115.25, 50.98],
                          [-115.25, 51.00],
                          [-115.27, 51.00],
                          [-115.27, 50.98]
                        ]
                      ]
                    }
                  }
                ]
              } as Response;
            }
            if (url.includes("W2002")) {
              return {
                ok: true,
                status: 200,
                json: async () => [
                  {
                    display_name: "Nakiska Ski Area, Alberta, Canada",
                    lat: "50.9500",
                    lon: "-115.1800",
                    geojson: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [-115.19, 50.94],
                          [-115.17, 50.94],
                          [-115.17, 50.96],
                          [-115.19, 50.96],
                          [-115.19, 50.94]
                        ]
                      ]
                    }
                  }
                ]
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Nakiska Ski Area",
                  lat: "50.9480",
                  lon: "-115.1730"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      const fortress = result.candidates.find((entry) => entry.osmId === 2001);
      const nakiska = result.candidates.find((entry) => entry.osmId === 2002);

      expect(result.candidates[0]?.osmId).toBe(2002);
      expect(nakiska?.validation.signals).toContain("name-matches-query");
      expect(fortress?.validation.issues.join(" ")).toMatch(/does not match selected resort name/i);
      expect((nakiska?.validation.score ?? 0) - (fortress?.validation.score ?? 0)).toBeGreaterThan(10);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("filters winter-sports overpass candidates with non-overlapping names", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-overpass-name-filter-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Nakiska Ski Area", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 333,
              displayName: "Nakiska Ski Area",
              center: [-115.173, 50.948],
              selectedAt: "2026-02-21T00:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 1 },
        {
          searchFn: async () => ({
            query: { name: "Nakiska Ski Area", country: "CA", limit: 1 },
            candidates: []
          }),
          fetchFn: (async (input: unknown) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input instanceof Request
                    ? input.url
                    : String(input);
            if (url.includes("overpass-api.de/api/interpreter")) {
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  elements: [
                    {
                      type: "way",
                      id: 4001,
                      tags: {
                        landuse: "winter_sports",
                        name: "Fortress Mountain Resort"
                      },
                      geometry: [
                        { lon: -115.27, lat: 50.98 },
                        { lon: -115.25, lat: 50.98 },
                        { lon: -115.25, lat: 51.00 },
                        { lon: -115.27, lat: 51.00 },
                        { lon: -115.27, lat: 50.98 }
                      ]
                    }
                  ]
                })
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Nakiska Ski Area",
                  lat: "50.9480",
                  lon: "-115.1730"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      expect(result.candidates.some((entry) => entry.osmId === 4001)).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("filters out far weak-match nominatim candidates", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-far-weak-match-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Nakiska Ski Area", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 135,
              displayName:
                "Nakiska Ski Area, Mount Allan Drive, Kananaskis Village, Kananaskis Improvement District, Alberta, Canada",
              center: [-115.1512647, 50.9419485],
              selectedAt: "2026-02-21T00:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 2 },
        {
          searchFn: async () => ({
            query: { name: "Nakiska Ski Area", country: "CA", limit: 2 },
            candidates: [
              {
                osmType: "way",
                osmId: 106710890,
                displayName:
                  "Nakiska Co-Op, Lake Shore Boulevard West, Etobicoke, Toronto, Ontario, Canada",
                center: [-79.516, 43.595],
                countryCode: "ca",
                country: "Canada",
                region: "Ontario",
                importance: 0.6,
                source: "nominatim"
              }
            ]
          }),
          fetchFn: (async (input: unknown) => {
            const url = String(input);
            if (url.includes("overpass-api.de/api/interpreter")) {
              return {
                ok: true,
                status: 200,
                json: async () => ({ elements: [] })
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Nakiska Ski Area",
                  lat: "50.9419485",
                  lon: "-115.1512647"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      expect(result.candidates.some((entry) => entry.osmId === 106710890)).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("uses overpass geometry fallback when lookup lacks polygon geojson", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-overpass-fallback-"));
    const workspacePath = join(workspace, "resort.json");

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Nakiska Ski Area", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 777,
              displayName: "Nakiska Ski Area",
              center: [-115.173, 50.948],
              selectedAt: "2026-02-21T00:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      const result = await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 1 },
        {
          searchFn: async () => ({
            query: { name: "Nakiska Ski Area", country: "CA", limit: 1 },
            candidates: []
          }),
          fetchFn: (async (input: unknown) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input instanceof Request
                    ? input.url
                    : String(input);
            if (url.includes("overpass-api.de/api/interpreter")) {
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  elements: [
                    {
                      type: "way",
                      id: 5001,
                      tags: {
                        landuse: "winter_sports",
                        name: "Nakiska Ski Area"
                      },
                      geometry: [
                        { lon: -115.19, lat: 50.94 },
                        { lon: -115.17, lat: 50.94 },
                        { lon: -115.17, lat: 50.96 },
                        { lon: -115.19, lat: 50.96 },
                        { lon: -115.19, lat: 50.94 }
                      ]
                    }
                  ]
                })
              } as Response;
            }
            if (url.includes("W5001")) {
              return {
                ok: true,
                status: 200,
                json: async () => [
                  {
                    display_name: "Nakiska Ski Area",
                    lat: "50.948",
                    lon: "-115.173"
                  }
                ]
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Nakiska Ski Area",
                  lat: "50.948",
                  lon: "-115.173"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      const candidate = result.candidates.find((entry) => entry.osmId === 5001);
      expect(candidate).toBeDefined();
      expect(candidate?.ring).not.toBeNull();
      expect(candidate?.validation.signals).toContain("from-overpass-geometry");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("uses explicit location hint in search variants", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-boundary-location-hint-"));
    const workspacePath = join(workspace, "resort.json");
    const searchNames: string[] = [];

    try {
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Nakiska Ski Area", country: "CA" },
            selection: {
              osmType: "node",
              osmId: 9999,
              displayName:
                "Nakiska Ski Area, Mount Allan Drive, Kananaskis Village, Kananaskis Improvement District, Alberta, Canada",
              center: [-115.1512647, 50.9419485],
              selectedAt: "2026-02-21T00:00:00.000Z"
            }
          },
          layers: {
            boundary: { status: "pending" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        }),
        "utf8"
      );

      await detectResortBoundaryCandidates(
        { workspacePath, searchLimit: 1, locationHint: "Kananaskis, Alberta" },
        {
          searchFn: async (query) => {
            searchNames.push(query.name);
            return {
              query,
              candidates: []
            };
          },
          fetchFn: (async (input: unknown) => {
            const url = String(input);
            if (url.includes("overpass-api.de/api/interpreter")) {
              return {
                ok: true,
                status: 200,
                json: async () => ({ elements: [] })
              } as Response;
            }
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  display_name: "Nakiska Ski Area",
                  lat: "50.9419485",
                  lon: "-115.1512647"
                }
              ]
            } as Response;
          }) as typeof fetch
        }
      );

      expect(searchNames.some((entry) => entry.includes("Kananaskis, Alberta"))).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
