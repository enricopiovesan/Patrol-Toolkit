import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadResortCatalog,
  loadPackFromCatalogEntry,
  isCatalogVersionCompatible,
  selectLatestEligibleVersions,
  type ResortCatalog,
  type SelectableResortPack
} from "./catalog";

describe("resort catalog selection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects single version even when unapproved", () => {
    const catalog: ResortCatalog = {
      schemaVersion: "1.0.0",
      resorts: [
        {
          resortId: "resort-a",
          resortName: "Resort A",
          versions: [{ version: "v1", approved: false, packUrl: "/packs/resort-a-v1.json" }]
        }
      ]
    };

    const selected = selectLatestEligibleVersions(catalog);
    expect(selected).toEqual([
      {
        resortId: "resort-a",
        resortName: "Resort A",
        version: "v1",
        packUrl: "/packs/resort-a-v1.json",
        createdAt: undefined
      }
    ]);
  });

  it("selects latest approved version when multiple versions exist", () => {
    const catalog: ResortCatalog = {
      schemaVersion: "1.0.0",
      resorts: [
        {
          resortId: "resort-b",
          resortName: "Resort B",
          versions: [
            { version: "v1", approved: true, packUrl: "/packs/resort-b-v1.json", createdAt: "2026-02-01T00:00:00.000Z" },
            { version: "v2", approved: false, packUrl: "/packs/resort-b-v2.json", createdAt: "2026-02-02T00:00:00.000Z" },
            { version: "v3", approved: true, packUrl: "/packs/resort-b-v3.json", createdAt: "2026-02-03T00:00:00.000Z" }
          ]
        }
      ]
    };

    const selected = selectLatestEligibleVersions(catalog);
    expect(selected).toEqual([
      {
        resortId: "resort-b",
        resortName: "Resort B",
        version: "v3",
        packUrl: "/packs/resort-b-v3.json",
        createdAt: "2026-02-03T00:00:00.000Z"
      }
    ]);
  });

  it("omits multi-version resort when no approved version exists", () => {
    const catalog: ResortCatalog = {
      schemaVersion: "1.0.0",
      resorts: [
        {
          resortId: "resort-c",
          resortName: "Resort C",
          versions: [
            { version: "v1", approved: false, packUrl: "/packs/resort-c-v1.json" },
            { version: "v2", approved: false, packUrl: "/packs/resort-c-v2.json" }
          ]
        }
      ]
    };

    const selected = selectLatestEligibleVersions(catalog);
    expect(selected).toEqual([]);
  });

  it("omits versions incompatible with current app version", () => {
    const catalog: ResortCatalog = {
      schemaVersion: "2.0.0",
      release: {
        channel: "stable",
        appVersion: "0.0.1",
        manifestUrl: "/releases/stable-manifest.json",
        manifestSha256: "a".repeat(64),
        createdAt: "2026-02-21T00:00:00.000Z"
      },
      resorts: [
        {
          resortId: "resort-compat",
          resortName: "Resort Compat",
          versions: [
            {
              version: "v3",
              approved: true,
              packUrl: "/packs/resort-compat-v3.json",
              createdAt: "2026-02-03T00:00:00.000Z",
              compatibility: {
                minAppVersion: "0.1.0"
              },
              checksums: {
                packSha256: "b".repeat(64),
                pmtilesSha256: "c".repeat(64),
                styleSha256: "d".repeat(64)
              }
            }
          ]
        }
      ]
    };

    const selected = selectLatestEligibleVersions(catalog, { appVersion: "0.0.1" });
    expect(selected).toEqual([]);
  });

  it("selects compatible approved version under schema 2.0.0", () => {
    const catalog: ResortCatalog = {
      schemaVersion: "2.0.0",
      release: {
        channel: "stable",
        appVersion: "0.0.1",
        manifestUrl: "/releases/stable-manifest.json",
        manifestSha256: "a".repeat(64),
        createdAt: "2026-02-21T00:00:00.000Z"
      },
      resorts: [
        {
          resortId: "resort-compatible",
          resortName: "Resort Compatible",
          versions: [
            {
              version: "v1",
              approved: true,
              packUrl: "/packs/resort-compatible-v1.json",
              createdAt: "2026-02-01T00:00:00.000Z",
              compatibility: {
                minAppVersion: "0.0.1",
                maxAppVersion: "0.2.0",
                supportedPackSchemaVersions: ["1.0.0"]
              },
              checksums: {
                packSha256: "1".repeat(64),
                pmtilesSha256: "2".repeat(64),
                styleSha256: "3".repeat(64)
              }
            }
          ]
        }
      ]
    };

    const selected = selectLatestEligibleVersions(catalog, {
      appVersion: "0.0.1",
      supportedPackSchemaVersion: "1.0.0"
    });
    expect(selected).toHaveLength(1);
    expect(selected[0]?.resortId).toBe("resort-compatible");
  });

  it("rejects schema 2.0.0 catalog when required checksums are missing", async () => {
    const payload = {
      schemaVersion: "2.0.0",
      release: {
        channel: "stable",
        appVersion: "0.0.1",
        manifestUrl: "/releases/stable-manifest.json",
        manifestSha256: "a".repeat(64),
        createdAt: "2026-02-21T00:00:00.000Z"
      },
      resorts: [
        {
          resortId: "resort-x",
          resortName: "Resort X",
          versions: [
            {
              version: "v1",
              approved: true,
              packUrl: "/packs/resort-x-v1.json",
              compatibility: {
                minAppVersion: "0.0.1"
              }
            }
          ]
        }
      ]
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(loadResortCatalog("/resort-packs/index.json")).rejects.toThrow(/checksums are required/iu);
  });

  it("checks explicit compatibility helper behavior", () => {
    const compatible = isCatalogVersionCompatible(
      {
        version: "v1",
        approved: true,
        packUrl: "/packs/x.json",
        compatibility: {
          minAppVersion: "0.0.1",
          maxAppVersion: "0.2.0",
          supportedPackSchemaVersions: ["1.0.0"]
        }
      },
      { appVersion: "0.0.1", supportedPackSchemaVersion: "1.0.0" }
    );
    expect(compatible).toBe(true);

    const incompatible = isCatalogVersionCompatible(
      {
        version: "v1",
        approved: true,
        packUrl: "/packs/x.json",
        compatibility: {
          minAppVersion: "0.1.0"
        }
      },
      { appVersion: "0.0.1", supportedPackSchemaVersion: "1.0.0" }
    );
    expect(incompatible).toBe(false);
  });

  it("loads export bundle by converting it into app resort pack", async () => {
    const entry: SelectableResortPack = {
      resortId: "CA_Golden_Kicking_Horse",
      resortName: "Kicking Horse",
      version: "v1",
      packUrl: "/packs/CA_Golden_Kicking_Horse.latest.validated.json"
    };

    const bundlePayload = {
      schemaVersion: "1.0.0",
      export: {
        resortKey: "CA_Golden_Kicking_Horse"
      },
      status: {
        resortKey: "CA_Golden_Kicking_Horse",
        query: {
          name: "Kicking Horse",
          countryCode: "CA"
        }
      },
      layers: {
        boundary: {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.98, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.27],
                [-116.98, 51.29]
              ]
            ]
          },
          properties: {}
        },
        areas: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-116.968, 51.295],
                    [-116.962, 51.295],
                    [-116.962, 51.291],
                    [-116.968, 51.295]
                  ]
                ]
              },
              properties: {
                id: "area-1",
                name: "Redemption Ridge",
                kind: "ridge"
              }
            }
          ]
        },
        runs: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-116.96, 51.293],
                  [-116.955, 51.289]
                ]
              },
              properties: {
                id: "run-1",
                name: "Pioneer",
                difficulty: "blue"
              }
            }
          ]
        },
        lifts: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-116.961, 51.294],
                  [-116.957, 51.29]
                ]
              },
              properties: {
                id: "lift-1",
                name: "Stairway"
              }
            }
          ]
        }
      }
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bundlePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const pack = await loadPackFromCatalogEntry(entry);
    expect(pack.resort.id).toBe("CA_Golden_Kicking_Horse");
    expect(pack.resort.name).toBe("Kicking Horse");
    expect(pack.boundary?.type).toBe("Polygon");
    expect(pack.areas).toHaveLength(1);
    expect(pack.areas?.[0]?.kind).toBe("ridge");
    expect(pack.runs).toHaveLength(1);
    expect(pack.lifts).toHaveLength(1);
  });

  it("uses cache-busted fetch URL for pack requests", async () => {
    const entry: SelectableResortPack = {
      resortId: "CA_Golden_Kicking_Horse",
      resortName: "Kicking Horse",
      version: "v1",
      packUrl: "/packs/CA_Golden_Kicking_Horse.latest.validated.json",
      createdAt: "2026-02-20T21:52:23.646Z"
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(loadPackFromCatalogEntry(entry)).rejects.toThrow(
      /Invalid resort pack for CA_Golden_Kicking_Horse/iu
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/packs/CA_Golden_Kicking_Horse.latest.validated.json?v=2026-02-20T21%3A52%3A23.646Z",
      { cache: "no-store" }
    );
  });

  it("prefers export resort key when status resort key casing differs", async () => {
    const entry: SelectableResortPack = {
      resortId: "CA_Golden_Kicking_Horse",
      resortName: "Kicking Horse",
      version: "v1",
      packUrl: "/packs/CA_Golden_Kicking_Horse.latest.validated.json"
    };

    const bundlePayload = {
      schemaVersion: "1.0.0",
      export: {
        resortKey: "CA_Golden_Kicking_Horse"
      },
      status: {
        resortKey: "CA_golden_kicking_horse",
        query: {
          name: "Kicking Horse",
          countryCode: "CA"
        }
      },
      layers: {
        runs: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-116.96, 51.293],
                  [-116.955, 51.289]
                ]
              },
              properties: {
                id: "run-1",
                name: "Pioneer",
                difficulty: "blue"
              }
            }
          ]
        },
        lifts: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-116.961, 51.294],
                  [-116.957, 51.29]
                ]
              },
              properties: {
                id: "lift-1",
                name: "Stairway"
              }
            }
          ]
        }
      }
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bundlePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const pack = await loadPackFromCatalogEntry(entry);
    expect(pack.resort.id).toBe("CA_Golden_Kicking_Horse");
    expect(pack.basemap.pmtilesPath).toBe("packs/CA_Golden_Kicking_Horse/base.pmtiles");
    expect(pack.basemap.stylePath).toBe("packs/CA_Golden_Kicking_Horse/style.json");
  });
});
