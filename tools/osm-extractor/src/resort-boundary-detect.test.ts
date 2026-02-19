import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNominatimLookupUrl, detectResortBoundaryCandidates } from "./resort-boundary-detect.js";

describe("resort boundary detect", () => {
  it("builds lookup URL with encoded OSM id", () => {
    const url = new URL(buildNominatimLookupUrl({ osmType: "relation", osmId: 123 }));
    expect(url.pathname).toBe("/lookup");
    expect(url.searchParams.get("osm_ids")).toBe("R123");
    expect(url.searchParams.get("polygon_geojson")).toBe("1");
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
      expect(result.candidates[1]?.validation.containsSelectionCenter).toBe(false);
      expect(result.candidates[1]?.validation.issues.join(" ")).toMatch(/outside candidate boundary/i);
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
});
