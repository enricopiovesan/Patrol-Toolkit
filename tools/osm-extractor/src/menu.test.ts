import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachBasemapAssetsToVersion,
  buildResortKey,
  canonicalizeResortKeys,
  computeBufferedBbox,
  createNextVersionClone,
  extractBoundaryRing,
  formatKnownResortSummary,
  formatSearchCandidate,
  getExistingResortLatestVersion,
  ensurePlanetilerRuntimeDefaults,
  isBoundaryReadyForSync,
  listKnownResorts,
  parseLayerSelection,
  parseCandidateSelection,
  parseDuplicateResortAction,
  persistResortVersion,
  readBasemapProviderConfig,
  readBoundaryRingFromArtifact,
  readOfflineBasemapMetrics,
  previewBasemapGeneration,
  resolveGeofabrikExtractPath,
  resolveBoundaryArtifactPath,
  generateBasemapAssetsForVersion,
  rankSearchCandidates,
  runInteractiveMenu,
  setLayerManualValidation,
  toManualValidationState,
  toCanonicalResortKey
} from "./menu.js";

describe("offline basemap metrics", () => {
  it("reports missing generated and published basemap files", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-metrics-empty-"));
    try {
      const metrics = await readOfflineBasemapMetrics({
        versionPath: join(root, "resorts", "CA_Golden_Kicking_Horse", "v1"),
        appPublicRoot: join(root, "public"),
        resortKey: "CA_Golden_Kicking_Horse"
      });

      expect(metrics).toEqual({
        generated: false,
        published: false,
        generatedPmtiles: false,
        generatedStyle: false,
        publishedPmtiles: false,
        publishedStyle: false,
        generatedPmtilesBytes: null,
        generatedStyleBytes: null,
        publishedPmtilesBytes: null,
        publishedStyleBytes: null
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports generated and published basemap files when present", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-metrics-full-"));
    try {
      const versionPath = join(root, "resorts", "CA_Golden_Kicking_Horse", "v1");
      const publicRoot = join(root, "public");
      const styleRaw = JSON.stringify({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
      await mkdir(join(versionPath, "basemap"), { recursive: true });
      await mkdir(join(publicRoot, "packs", "CA_Golden_Kicking_Horse"), { recursive: true });
      await writeFile(join(versionPath, "basemap", "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(join(versionPath, "basemap", "style.json"), styleRaw, "utf8");
      await writeFile(join(publicRoot, "packs", "CA_Golden_Kicking_Horse", "base.pmtiles"), new Uint8Array([2, 3, 4, 5]));
      await writeFile(join(publicRoot, "packs", "CA_Golden_Kicking_Horse", "style.json"), styleRaw, "utf8");

      const metrics = await readOfflineBasemapMetrics({
        versionPath,
        appPublicRoot: publicRoot,
        resortKey: "CA_Golden_Kicking_Horse"
      });

      expect(metrics).toEqual({
        generated: true,
        published: true,
        generatedPmtiles: true,
        generatedStyle: true,
        publishedPmtiles: true,
        publishedStyle: true,
        generatedPmtilesBytes: 4,
        generatedStyleBytes: Buffer.byteLength(styleRaw),
        publishedPmtilesBytes: 4,
        publishedStyleBytes: Buffer.byteLength(styleRaw)
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("boundary geometry utilities", () => {
  it("extracts the largest polygon ring from mixed FeatureCollection geometry", () => {
    const ring = extractBoundaryRing({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-116.95, 51.3] }
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [-116.96, 51.3],
                  [-116.95, 51.3],
                  [-116.95, 51.31],
                  [-116.96, 51.31],
                  [-116.96, 51.3]
                ]
              ],
              [
                [
                  [-116.97, 51.29],
                  [-116.93, 51.29],
                  [-116.93, 51.33],
                  [-116.97, 51.33],
                  [-116.97, 51.29]
                ]
              ]
            ]
          }
        }
      ]
    });

    expect(ring).toEqual([
      [-116.97, 51.29],
      [-116.93, 51.29],
      [-116.93, 51.33],
      [-116.97, 51.33],
      [-116.97, 51.29]
    ]);
  });

  it("computes a buffered bbox with 1000m expansion", () => {
    const bbox = computeBufferedBbox(
      [
        [-116.97, 51.29],
        [-116.95, 51.29],
        [-116.95, 51.31],
        [-116.97, 51.31],
        [-116.97, 51.29]
      ],
      1000
    );

    expect(bbox.minLon).toBeCloseTo(-116.9842, 3);
    expect(bbox.maxLon).toBeCloseTo(-116.9358, 3);
    expect(bbox.minLat).toBeCloseTo(51.2810, 3);
    expect(bbox.maxLat).toBeCloseTo(51.3190, 3);
  });

  it("returns a precise error when artifact has no polygon geometry", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-boundary-artifact-invalid-"));
    try {
      const path = join(root, "boundary.geojson");
      await writeFile(
        path,
        JSON.stringify({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-116.95, 51.3] } }]
        }),
        "utf8"
      );

      await expect(readBoundaryRingFromArtifact(path)).rejects.toThrow(/FeatureCollection has no Polygon or MultiPolygon feature/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves boundary artifact path from cwd when workspace stores resorts-relative path", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-boundary-path-cwd-"));
    const originalCwd = process.cwd();
    try {
      const versionPath = join(root, "resorts", "CA_Golden_Kicking_Horse", "v1");
      const boundaryPath = join(versionPath, "boundary.geojson");
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        boundaryPath,
        JSON.stringify({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          }
        }),
        "utf8"
      );
      process.chdir(root);
      const resolved = await resolveBoundaryArtifactPath(
        {
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "resorts/CA_Golden_Kicking_Horse/v1/boundary.geojson" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        },
        versionPath
      );
      expect(resolved.endsWith("/resorts/CA_Golden_Kicking_Horse/v1/boundary.geojson")).toBe(true);
    } finally {
      process.chdir(originalCwd);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to boundary file under current version when stored path points to legacy resort key", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-boundary-path-legacy-key-"));
    try {
      const versionPath = join(root, "resorts", "CA_Golden_Kicking_Horse", "v1");
      const boundaryPath = join(versionPath, "boundary.geojson");
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        boundaryPath,
        JSON.stringify({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          }
        }),
        "utf8"
      );

      const resolved = await resolveBoundaryArtifactPath(
        {
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "resorts/CA_golden_kicking_horse/v1/boundary.geojson" },
            lifts: { status: "pending" },
            runs: { status: "pending" }
          }
        },
        versionPath
      );
      expect(resolved.endsWith("/resorts/CA_Golden_Kicking_Horse/v1/boundary.geojson")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("geofabrik resolver", () => {
  it("downloads and caches a country extract", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-cache-"));
    try {
      const indexPayload = {
        features: [
          {
            properties: {
              id: "north-america/canada",
              "iso3166-1:alpha2": "CA",
              urls: { pbf: "https://download.geofabrik.de/north-america/canada-latest.osm.pbf" }
            }
          }
        ]
      };
      let downloads = 0;
      const fetchFn = (async () => {
        downloads += 1;
        return new Response(Uint8Array.from([1, 2, 3, 4]), { status: 200 });
      }) as typeof fetch;

      const first = await resolveGeofabrikExtractPath({
        countryCode: "CA",
        cacheDir: root,
        fetchJsonFn: async () => indexPayload,
        fetchFn
      });
      const firstBytes = await readFile(first);
      expect([...firstBytes]).toEqual([1, 2, 3, 4]);
      expect(downloads).toBe(1);

      const second = await resolveGeofabrikExtractPath({
        countryCode: "CA",
        cacheDir: root,
        fetchJsonFn: async () => indexPayload,
        fetchFn: (async () => {
          throw new Error("should not download when cache exists");
        }) as typeof fetch
      });
      expect(second).toBe(first);
      expect(downloads).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("selects deeper subdivision extract for the same country", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-subdivision-"));
    try {
      let downloadedUrl = "";
      await resolveGeofabrikExtractPath({
        countryCode: "CA",
        cacheDir: root,
        fetchJsonFn: async () => ({
          features: [
            {
              properties: {
                id: "north-america/canada",
                "iso3166-1:alpha2": "CA",
                urls: { pbf: "https://download.geofabrik.de/north-america/canada-latest.osm.pbf" }
              }
            },
            {
              properties: {
                id: "north-america/canada/british-columbia",
                "iso3166-2": "CA-BC",
                urls: { pbf: "https://download.geofabrik.de/north-america/canada/british-columbia-latest.osm.pbf" }
              }
            }
          ]
        }),
        fetchFn: (async (url) => {
          downloadedUrl = String(url);
          return new Response(Uint8Array.from([9, 9, 9]), { status: 200 });
        }) as typeof fetch
      });
      expect(downloadedUrl).toContain("british-columbia-latest.osm.pbf");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prefers subdivision containing resort location when multiple match country", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-location-match-"));
    try {
      let downloadedUrl = "";
      await resolveGeofabrikExtractPath({
        countryCode: "CA",
        cacheDir: root,
        locationLon: -116.9624,
        locationLat: 51.2937,
        fetchJsonFn: async () => ({
          features: [
            {
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-114.0, 49.0],
                    [-110.0, 49.0],
                    [-110.0, 60.0],
                    [-114.0, 60.0],
                    [-114.0, 49.0]
                  ]
                ]
              },
              properties: {
                id: "north-america/canada/alberta",
                "iso3166-2": "CA-AB",
                urls: { pbf: "https://download.geofabrik.de/north-america/canada/alberta-latest.osm.pbf" }
              }
            },
            {
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-139.0, 48.0],
                    [-114.0, 48.0],
                    [-114.0, 61.0],
                    [-139.0, 61.0],
                    [-139.0, 48.0]
                  ]
                ]
              },
              properties: {
                id: "north-america/canada/british-columbia",
                "iso3166-2": "CA-BC",
                urls: { pbf: "https://download.geofabrik.de/north-america/canada/british-columbia-latest.osm.pbf" }
              }
            }
          ]
        }),
        fetchFn: (async (url) => {
          downloadedUrl = String(url);
          return new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
        }) as typeof fetch
      });

      expect(downloadedUrl).toContain("british-columbia-latest.osm.pbf");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails with clear error when country has no extract", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-no-match-"));
    try {
      await expect(
        resolveGeofabrikExtractPath({
          countryCode: "XX",
          cacheDir: root,
          fetchJsonFn: async () => ({ features: [] }),
          fetchFn: (async () => new Response(Uint8Array.from([1]), { status: 200 })) as typeof fetch
        })
      ).rejects.toThrow(/No Geofabrik extract found for country code 'XX'/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails on invalid country code input", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-invalid-country-"));
    try {
      await expect(
        resolveGeofabrikExtractPath({
          countryCode: "CAN",
          cacheDir: root,
          fetchJsonFn: async () => ({ features: [] }),
          fetchFn: (async () => new Response(Uint8Array.from([1]), { status: 200 })) as typeof fetch
        })
      ).rejects.toThrow(/Invalid country code 'CAN'/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails on invalid geofabrik index payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-invalid-index-"));
    try {
      await expect(
        resolveGeofabrikExtractPath({
          countryCode: "CA",
          cacheDir: root,
          fetchJsonFn: async () => ({ invalid: true }),
          fetchFn: (async () => new Response(Uint8Array.from([1]), { status: 200 })) as typeof fetch
        })
      ).rejects.toThrow(/Invalid Geofabrik index payload/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when extract download fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-geofabrik-download-fail-"));
    try {
      await expect(
        resolveGeofabrikExtractPath({
          countryCode: "CA",
          cacheDir: root,
          fetchJsonFn: async () => ({
            features: [
              {
                properties: {
                  id: "north-america/canada",
                  "iso3166-1:alpha2": "CA",
                  urls: { pbf: "https://download.geofabrik.de/north-america/canada-latest.osm.pbf" }
                }
              }
            ]
          }),
          fetchFn: (async () => new Response("error", { status: 503 })) as typeof fetch
        })
      ).rejects.toThrow(/Failed to download Geofabrik extract: HTTP 503/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("basemap provider config", () => {
  it("rejects invalid config field types", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-invalid-"));
    try {
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: "1000",
          maxZoom: 15,
          planetilerCommand: "echo ok"
        }),
        "utf8"
      );

      await expect(
        readBasemapProviderConfig({
          PTK_BASEMAP_CONFIG_PATH: configPath
        })
      ).rejects.toThrow(/bufferMeters.*number/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads config defaults and ignores legacy env overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-ok-"));
    try {
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1200,
          maxZoom: 14,
          planetilerCommand: "echo from-config"
        }),
        "utf8"
      );

      const resolved = await readBasemapProviderConfig({
        PTK_BASEMAP_CONFIG_PATH: configPath,
        PTK_BASEMAP_PROVIDER: "something-else",
        PTK_BASEMAP_BUFFER_METERS: "5000",
        PTK_BASEMAP_MAX_ZOOM: "15",
        PTK_BASEMAP_PLANETILER_CMD: "echo from-env"
      });

      expect(resolved).toEqual({
        provider: "openmaptiles-planetiler",
        bufferMeters: 1200,
        maxZoom: 14,
        planetilerCommand: "echo from-config"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves default config path from repo root or extractor cwd", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-default-path-"));
    const originalCwd = process.cwd();
    try {
      const configDir = join(root, "tools", "osm-extractor", "config");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "basemap-provider.json"),
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: "echo from-default"
        }),
        "utf8"
      );

      process.chdir(root);
      const fromRoot = await readBasemapProviderConfig({});
      expect(fromRoot.planetilerCommand).toBe("echo from-default");

      process.chdir(join(root, "tools", "osm-extractor"));
      const fromExtractorCwd = await readBasemapProviderConfig({});
      expect(fromExtractorCwd.planetilerCommand).toBe("echo from-default");
    } finally {
      process.chdir(originalCwd);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects placeholder or empty planetilerCommand from config", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-missing-cmd-"));
    try {
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: "REPLACE_WITH_LOCAL_PLANETILER_COMMAND"
        }),
        "utf8"
      );

      await expect(
        readBasemapProviderConfig({
          PTK_BASEMAP_CONFIG_PATH: configPath
        })
      ).rejects.toThrow(/planetilerCommand is required/iu);

      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: "   "
        }),
        "utf8"
      );

      await expect(
        readBasemapProviderConfig({
          PTK_BASEMAP_CONFIG_PATH: configPath
        })
      ).rejects.toThrow(/planetilerCommand is required/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsupported provider from config", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-provider-"));
    try {
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "something-else",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: "echo ok"
        }),
        "utf8"
      );

      await expect(
        readBasemapProviderConfig({
          PTK_BASEMAP_CONFIG_PATH: configPath
        })
      ).rejects.toThrow(/Unsupported basemap provider/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects max zoom above planetiler limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-provider-config-maxzoom-"));
    try {
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 16,
          planetilerCommand: "echo ok"
        }),
        "utf8"
      );

      await expect(
        readBasemapProviderConfig({
          PTK_BASEMAP_CONFIG_PATH: configPath
        })
      ).rejects.toThrow(/maxZoom must be <= 15/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("planetiler runtime defaults", () => {
  it("forces download and adds cache directories when command omits them", () => {
    const normalized = ensurePlanetilerRuntimeDefaults("java -jar planetiler.jar --output=out.pmtiles", {
      downloadDir: "/tmp/planetiler/sources",
      tempDir: "/tmp/planetiler/tmp"
    });
    expect(normalized).toContain("--download=true");
    expect(normalized).toContain("--download_dir='/tmp/planetiler/sources'");
    expect(normalized).toContain("--tmpdir='/tmp/planetiler/tmp'");
    expect(normalized).toContain("--force=true");
  });

  it("rewrites download=false and force=false to true", () => {
    const normalized = ensurePlanetilerRuntimeDefaults(
      "java -jar planetiler.jar --download=false --force=false --download_dir='/a' --tmpdir='/b'",
      {
        downloadDir: "/tmp/planetiler/sources",
        tempDir: "/tmp/planetiler/tmp"
      }
    );
    expect(normalized).toContain("--download=true");
    expect(normalized).toContain("--force=true");
    expect(normalized).toContain("--download_dir='/a'");
    expect(normalized).toContain("--tmpdir='/b'");
  });

  it("does not modify non-planetiler commands", () => {
    const command = "cp '/tmp/source.pmtiles' '/tmp/out.pmtiles'";
    expect(
      ensurePlanetilerRuntimeDefaults(command, {
        downloadDir: "/tmp/planetiler/sources",
        tempDir: "/tmp/planetiler/tmp"
      })
    ).toBe(command);
  });
});

describe("attach basemap assets", () => {
  it("copies basemap files into version basemap directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-attach-basemap-"));
    try {
      const versionPath = join(root, "resorts", "CA_Golden_Kicking_Horse", "v1");
      const sourcePath = join(root, "sources");
      await mkdir(versionPath, { recursive: true });
      await mkdir(sourcePath, { recursive: true });
      await writeFile(join(sourcePath, "source.pmtiles"), new Uint8Array([11, 22]));
      await writeFile(
        join(sourcePath, "source-style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] })
      );

      await attachBasemapAssetsToVersion({
        versionPath,
        pmtilesSourcePath: join(sourcePath, "source.pmtiles"),
        styleSourcePath: join(sourcePath, "source-style.json")
      });

      const copiedPmtiles = await readFile(join(versionPath, "basemap", "base.pmtiles"));
      const copiedStyle = await readFile(join(versionPath, "basemap", "style.json"), "utf8");
      expect([...copiedPmtiles]).toEqual([11, 22]);
      expect(JSON.parse(copiedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("generates basemap assets from shared resort basemap source without prompts", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-generate-basemap-"));
    try {
      const resortsRoot = join(root, "resorts");
      const publicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const versionPath = join(resortsRoot, resortKey, "v2");
      await mkdir(join(versionPath), { recursive: true });
      await mkdir(join(resortsRoot, resortKey, "basemap"), { recursive: true });
      await writeFile(join(resortsRoot, resortKey, "basemap", "base.pmtiles"), new Uint8Array([9, 8, 7, 6]));
      await writeFile(
        join(resortsRoot, resortKey, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] })
      );

      const result = await generateBasemapAssetsForVersion({
        resortsRoot,
        appPublicRoot: publicRoot,
        resortKey,
        versionPath
      });

      expect(result.generatedNow).toBe(true);
      const copiedPmtiles = await readFile(join(versionPath, "basemap", "base.pmtiles"));
      const copiedStyle = await readFile(join(versionPath, "basemap", "style.json"), "utf8");
      expect([...copiedPmtiles]).toEqual([9, 8, 7, 6]);
      expect(JSON.parse(copiedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("generates basemap assets from latest prior version basemap", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-generate-basemap-prev-version-"));
    try {
      const resortsRoot = join(root, "resorts");
      const publicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const previousVersionPath = join(resortsRoot, resortKey, "v1");
      const currentVersionPath = join(resortsRoot, resortKey, "v2");
      await mkdir(join(previousVersionPath, "basemap"), { recursive: true });
      await mkdir(currentVersionPath, { recursive: true });
      await writeFile(join(previousVersionPath, "basemap", "base.pmtiles"), new Uint8Array([4, 5, 6, 7]));
      await writeFile(
        join(previousVersionPath, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] })
      );

      const result = await generateBasemapAssetsForVersion({
        resortsRoot,
        appPublicRoot: publicRoot,
        resortKey,
        versionPath: currentVersionPath
      });

      expect(result.generatedNow).toBe(true);
      expect(result.sourceLabel).toBe("existing version v1");
      const copiedPmtiles = await readFile(join(currentVersionPath, "basemap", "base.pmtiles"));
      const copiedStyle = await readFile(join(currentVersionPath, "basemap", "style.json"), "utf8");
      expect([...copiedPmtiles]).toEqual([4, 5, 6, 7]);
      expect(JSON.parse(copiedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when no offline-ready basemap source exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-generate-basemap-missing-source-"));
    try {
      const resortsRoot = join(root, "resorts");
      const publicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const currentVersionPath = join(resortsRoot, resortKey, "v3");
      await mkdir(currentVersionPath, { recursive: true });

      await expect(
        generateBasemapAssetsForVersion({
          resortsRoot,
          appPublicRoot: publicRoot,
          resortKey,
          versionPath: currentVersionPath
        })
      ).rejects.toThrow(/No offline-ready basemap source found/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when current version basemap exists but is placeholder content", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-generate-basemap-invalid-current-"));
    try {
      const resortsRoot = join(root, "resorts");
      const publicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const currentVersionPath = join(resortsRoot, resortKey, "v4");
      await mkdir(join(currentVersionPath, "basemap"), { recursive: true });
      await writeFile(join(currentVersionPath, "basemap", "base.pmtiles"), new Uint8Array([80, 84, 75]));
      await writeFile(
        join(currentVersionPath, "basemap", "style.json"),
        JSON.stringify({
          version: 8,
          name: "Patrol Toolkit CLI Generated Basemap",
          sources: {},
          layers: [{ id: "cli-generated-background", type: "background" }]
        }),
        "utf8"
      );

      await expect(
        generateBasemapAssetsForVersion({
          resortsRoot,
          appPublicRoot: publicRoot,
          resortKey,
          versionPath: currentVersionPath
        })
      ).rejects.toThrow(/placeholder content/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("force rebuild regenerates even when current version basemap is already offline-ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-generate-basemap-force-"));
    try {
      const resortsRoot = join(root, "resorts");
      const publicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const currentVersionPath = join(resortsRoot, resortKey, "v2");
      await mkdir(join(currentVersionPath, "basemap"), { recursive: true });
      await mkdir(join(resortsRoot, resortKey, "basemap"), { recursive: true });
      await writeFile(join(currentVersionPath, "basemap", "base.pmtiles"), new Uint8Array([1, 1, 1, 1]));
      await writeFile(
        join(currentVersionPath, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] })
      );
      await writeFile(join(resortsRoot, resortKey, "basemap", "base.pmtiles"), new Uint8Array([9, 9, 9, 9]));
      await writeFile(
        join(resortsRoot, resortKey, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] })
      );

      const result = await generateBasemapAssetsForVersion({
        resortsRoot,
        appPublicRoot: publicRoot,
        resortKey,
        versionPath: currentVersionPath,
        forceRebuild: true
      });

      expect(result.generatedNow).toBe(true);
      expect(result.sourceLabel).toBe("resort shared basemap");
      const copiedPmtiles = await readFile(join(currentVersionPath, "basemap", "base.pmtiles"));
      expect([...copiedPmtiles]).toEqual([9, 9, 9, 9]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds deterministic dry-run preview with no writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-basemap-dry-run-"));
    const originalEnv = { ...process.env };
    try {
      const resortsRoot = join(root, "resorts");
      const appPublicRoot = join(root, "public");
      const resortKey = "CA_Golden_Kicking_Horse";
      const versionPath = join(resortsRoot, resortKey, "v1");
      await mkdir(versionPath, { recursive: true });
      await mkdir(join(resortsRoot, resortKey, "basemap"), { recursive: true });
      await writeFile(join(resortsRoot, resortKey, "basemap", "base.pmtiles"), new Uint8Array([7, 7, 7, 7]));
      await writeFile(
        join(resortsRoot, resortKey, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector", url: "pmtiles://./base.pmtiles" } }, layers: [] })
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[[-116.97, 51.29], [-116.95, 51.29], [-116.95, 51.31], [-116.97, 51.31], [-116.97, 51.29]]]
          },
          properties: {}
        }),
        "utf8"
      );
      const workspace = {
        schemaVersion: "2.0.0" as const,
        resort: {
          query: { name: "Kicking Horse", country: "CA" }
        },
        layers: {
          boundary: { status: "complete" as const, artifactPath: "boundary.geojson", featureCount: 1 },
          runs: { status: "complete" as const, artifactPath: "runs.geojson", featureCount: 10 },
          lifts: { status: "complete" as const, artifactPath: "lifts.geojson", featureCount: 3 }
        }
      };
      const configPath = join(root, "basemap-provider.json");
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: "java -jar {planetilerJarPath} --bounds={bboxCsv} --output={outputPmtiles}"
        }),
        "utf8"
      );
      process.env.PTK_BASEMAP_CONFIG_PATH = configPath;

      const preview = await previewBasemapGeneration({
        workspace,
        versionPath,
        resortsRoot,
        resortKey,
        appPublicRoot,
        forceRebuild: false
      });

      expect(preview.mode).toBe("dry-run");
      expect(preview.targetVersionBasemapDir).toBe(join(versionPath, "basemap"));
      expect(preview.sourceLabel).toBe("resort shared basemap");
      expect(preview.providerSummary?.provider).toBe("openmaptiles-planetiler");
      expect(preview.providerSummary?.commandPreview).toContain("--bounds=");
      expect(preview.providerSummary?.commandPreview).toContain("download_dir=");
      expect(preview.currentVersionOfflineReady).toBe(false);

      const targetBasemapDirExists = await fileExists(join(versionPath, "basemap"));
      expect(targetBasemapDirExists).toBe(false);
    } finally {
      restoreProcessEnv(originalEnv);
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("menu known resort listing", () => {
  it("returns empty list when resorts root does not exist", async () => {
    const path = join(tmpdir(), `resorts-missing-${Date.now()}-${Math.random()}`);
    const result = await listKnownResorts(path);
    expect(result).toEqual([]);
  });

  it("lists resorts with latest immutable version and manual validation flag", async () => {
    const root = await mkdtemp(join(tmpdir(), "resorts-root-"));
    try {
      const resortPath = join(root, "CA_Golden_Kicking_Horse");
      await mkdir(join(resortPath, "v1"), { recursive: true });
      await mkdir(join(resortPath, "v2"), { recursive: true });
      await writeFile(
        join(resortPath, "v2", "status.json"),
        JSON.stringify(
          {
            createdAt: "2026-02-21T12:00:00.000Z",
            readiness: {
              overall: "incomplete",
              issues: ["runs pending"]
            },
            layers: {
              boundary: { status: "complete", featureCount: 1, checksumSha256: "abc123", updatedAt: "2026-02-21T12:01:00.000Z" },
              runs: { status: "pending", featureCount: null, checksumSha256: null, updatedAt: null },
              lifts: { status: "complete", featureCount: 7, checksumSha256: "def456", updatedAt: "2026-02-21T12:02:00.000Z" }
            },
            manualValidation: {
              validated: true
            }
          },
          null,
          2
        ),
        "utf8"
      );

      const result = await listKnownResorts(root);
      expect(result).toEqual([
        {
          resortKey: "CA_Golden_Kicking_Horse",
          latestVersion: "v2",
          latestVersionNumber: 2,
          manuallyValidated: true,
          readinessOverall: "incomplete",
          readinessIssueCount: 1,
          createdAt: "2026-02-21T12:00:00.000Z",
          layers: {
            boundary: {
              status: "complete",
              featureCount: 1,
              checksumSha256: "abc123",
              updatedAt: "2026-02-21T12:01:00.000Z"
            },
            runs: {
              status: "pending",
              featureCount: null,
              checksumSha256: null,
              updatedAt: null
            },
            lifts: {
              status: "complete",
              featureCount: 7,
              checksumSha256: "def456",
              updatedAt: "2026-02-21T12:02:00.000Z"
            }
          }
        }
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores hidden directories like .cache in resort list", async () => {
    const root = await mkdtemp(join(tmpdir(), "resorts-root-hidden-"));
    try {
      await mkdir(join(root, ".cache", "geofabrik"), { recursive: true });
      const resortPath = join(root, "CA_Golden_Kicking_Horse");
      await mkdir(join(resortPath, "v1"), { recursive: true });
      await writeFile(
        join(resortPath, "v1", "status.json"),
        JSON.stringify(
          {
            createdAt: "2026-02-21T12:00:00.000Z",
            readiness: { overall: "ready", issues: [] },
            layers: {
              boundary: { status: "complete", featureCount: 1, checksumSha256: "abc123", updatedAt: "2026-02-21T12:01:00.000Z" },
              runs: { status: "complete", featureCount: 72, checksumSha256: "def456", updatedAt: "2026-02-21T12:02:00.000Z" },
              lifts: { status: "complete", featureCount: 7, checksumSha256: "ghi789", updatedAt: "2026-02-21T12:03:00.000Z" }
            },
            manualValidation: { validated: true }
          },
          null,
          2
        ),
        "utf8"
      );

      const result = await listKnownResorts(root);
      expect(result.map((entry) => entry.resortKey)).toEqual(["CA_Golden_Kicking_Horse"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("menu candidate selection parsing", () => {
  it("returns selected index for valid range", () => {
    expect(parseCandidateSelection("1", 3)).toBe(1);
    expect(parseCandidateSelection("3", 3)).toBe(3);
  });

  it("returns null when selection is cancel", () => {
    expect(parseCandidateSelection("0", 3)).toBeNull();
  });

  it("returns -1 for invalid selections", () => {
    expect(parseCandidateSelection("-1", 3)).toBe(-1);
    expect(parseCandidateSelection("4", 3)).toBe(-1);
    expect(parseCandidateSelection("abc", 3)).toBe(-1);
    expect(parseCandidateSelection("1.2", 3)).toBe(-1);
  });
});

describe("menu duplicate resort action parsing", () => {
  it("parses duplicate action menu options", () => {
    expect(parseDuplicateResortAction("1")).toBe("create");
    expect(parseDuplicateResortAction("2")).toBe("cancel");
    expect(parseDuplicateResortAction("0")).toBeNull();
    expect(parseDuplicateResortAction("abc")).toBeNull();
  });
});

describe("menu layer selection parsing", () => {
  it("parses canonical and shorthand layer selections", () => {
    expect(parseLayerSelection("all")).toEqual(["boundary", "runs", "lifts"]);
    expect(parseLayerSelection("a")).toEqual(["boundary", "runs", "lifts"]);
    expect(parseLayerSelection("boundary,runs")).toEqual(["boundary", "runs"]);
    expect(parseLayerSelection("r l")).toEqual(["runs", "lifts"]);
    expect(parseLayerSelection("l,b,r")).toEqual(["boundary", "runs", "lifts"]);
  });

  it("returns null for invalid layer selections", () => {
    expect(parseLayerSelection("")).toBeNull();
    expect(parseLayerSelection("unknown")).toBeNull();
    expect(parseLayerSelection("boundary,unknown")).toBeNull();
  });
});

describe("menu output formatting", () => {
  it("formats known resort summary with detail lines", () => {
    const line = formatKnownResortSummary(1, {
      resortKey: "CA_Golden_Kicking_Horse",
      latestVersion: "v2",
      latestVersionNumber: 2,
      manuallyValidated: true,
      readinessOverall: "incomplete",
      readinessIssueCount: 2,
      createdAt: "2026-02-21T12:00:00.000Z",
      layers: {
        boundary: {
          status: "complete",
          featureCount: 1,
          checksumSha256: "1234567890abcdef",
          updatedAt: "2026-02-21T12:01:00.000Z"
        },
        runs: {
          status: "pending",
          featureCount: null,
          checksumSha256: null,
          updatedAt: null
        },
        lifts: {
          status: "complete",
          featureCount: 7,
          checksumSha256: "abcdef1234567890",
          updatedAt: "2026-02-21T12:02:00.000Z"
        }
      }
    });
    expect(line).toContain("1. CA_Golden_Kicking_Horse");
    expect(line).toContain("Latest version : v2");
    expect(line).toContain("Validated      : yes");
    expect(line).toContain("Readiness      : incomplete (2 issue(s))");
    expect(line).toContain("- Boundary status=complete  features=1  checksum=1234567890ab");
    expect(line).toContain("- Runs     status=pending  features=?  checksum=n/a");
  });

  it("formats search candidate with labeled metadata", () => {
    const text = formatSearchCandidate(2, {
      candidate: {
        osmType: "node",
        osmId: 7248641928,
        displayName: "Kicking Horse, Golden, Canada",
        countryCode: "ca",
        country: "Canada",
        region: "British Columbia",
        center: [-116.96246, 51.29371],
        importance: 0.438,
        source: "nominatim"
      },
      hasPolygonGeometry: true
    });

    expect(text).toMatch(/^2\. Kicking Horse, Golden, Canada/);
    expect(text).toMatch(/OSM: node\/7248641928/);
    expect(text).toMatch(/Country: CA/);
    expect(text).toMatch(/Region: British Columbia/);
    expect(text).toMatch(/Center: 51\.29371,-116\.96246/);
    expect(text).toMatch(/Importance: 0\.438/);
    expect(text).toMatch(/BoundaryGeometry=yes/);
  });
});

describe("menu search ranking", () => {
  it("ranks polygon+relation candidates first", async () => {
    const ranked = await rankSearchCandidates(
      [
        {
          osmType: "node",
          osmId: 1,
          displayName: "Node Candidate",
          countryCode: "ca",
          country: "Canada",
          region: "BC",
          center: [-116, 51],
          importance: 0.9,
          source: "nominatim"
        },
        {
          osmType: "relation",
          osmId: 2,
          displayName: "Relation Candidate",
          countryCode: "ca",
          country: "Canada",
          region: "BC",
          center: [-116, 51],
          importance: 0.1,
          source: "nominatim"
        }
      ],
      {
        hasPolygonFn: async (candidate) => candidate.osmType === "relation"
      }
    );

    expect(ranked[0]?.candidate.osmId).toBe(2);
    expect(ranked[1]?.candidate.osmId).toBe(1);
  });

  it("prioritizes candidates matching requested town", async () => {
    const ranked = await rankSearchCandidates(
      [
        {
          osmType: "relation",
          osmId: 1,
          displayName: "Kicking Horse, Morin-Heights, Canada",
          countryCode: "ca",
          country: "Canada",
          region: "Quebec",
          center: [-74.2, 45.8],
          importance: 0.9,
          source: "nominatim"
        },
        {
          osmType: "relation",
          osmId: 2,
          displayName: "Kicking Horse Mountain Resort, Golden, Canada",
          countryCode: "ca",
          country: "Canada",
          region: "British Columbia",
          center: [-116.96, 51.29],
          importance: 0.1,
          source: "nominatim"
        }
      ],
      {
        town: "Golden",
        hasPolygonFn: async () => true
      }
    );

    expect(ranked[0]?.candidate.osmId).toBe(2);
    expect(ranked[1]?.candidate.osmId).toBe(1);
  });
});

describe("menu resort persistence", () => {
  it("builds normalized resort key with ASCII underscore format", () => {
    expect(buildResortKey("ca", "Morin-Heights", "Kicking Horse")).toBe("CA_Morin_Heights_Kicking_Horse");
    expect(buildResortKey("CA", "Québec", "Mont-Sainte-Anne")).toBe("CA_Quebec_Mont_Sainte_Anne");
  });

  it("creates immutable versions for duplicate resort additions", async () => {
    const root = await mkdtemp(join(tmpdir(), "resorts-persist-"));
    const candidate = {
      osmType: "node" as const,
      osmId: 7248641928,
      displayName: "Kicking Horse, Golden, Canada",
      countryCode: "ca",
      country: "Canada",
      region: "British Columbia",
      center: [-116.96246, 51.29371] as [number, number],
      importance: 0.438,
      source: "nominatim" as const
    };
    try {
      const first = await persistResortVersion({
        resortsRoot: root,
        countryCode: "CA",
        town: "Golden",
        resortName: "Kicking Horse",
        candidate,
        selectedAt: "2026-02-20T10:00:00.000Z",
        createdAt: "2026-02-20T10:00:00.000Z"
      });
      const second = await persistResortVersion({
        resortsRoot: root,
        countryCode: "CA",
        town: "Golden",
        resortName: "Kicking Horse",
        candidate,
        selectedAt: "2026-02-20T11:00:00.000Z",
        createdAt: "2026-02-20T11:00:00.000Z"
      });

      expect(first.resortKey).toBe("CA_Golden_Kicking_Horse");
      expect(first.version).toBe("v1");
      expect(first.wasExistingResort).toBe(false);
      expect(second.version).toBe("v2");
      expect(second.wasExistingResort).toBe(true);

      const latest = await getExistingResortLatestVersion(root, "CA_Golden_Kicking_Horse");
      expect(latest).toBe("v2");
      const missing = await getExistingResortLatestVersion(root, "CA_Golden_Unknown");
      expect(missing).toBeNull();

      const statusRaw = await readFile(second.statusPath, "utf8");
      const status = JSON.parse(statusRaw) as { manualValidation: { validated: boolean } };
      expect(status.manualValidation.validated).toBe(false);

      const known = await listKnownResorts(root);
      expect(known).toEqual([
        {
          resortKey: "CA_Golden_Kicking_Horse",
          latestVersion: "v2",
          latestVersionNumber: 2,
          manuallyValidated: false,
          readinessOverall: "incomplete",
          readinessIssueCount: 0,
          createdAt: "2026-02-20T11:00:00.000Z",
          layers: {
            boundary: {
              status: "pending",
              featureCount: null,
              checksumSha256: null,
              updatedAt: null
            },
            runs: {
              status: "pending",
              featureCount: null,
              checksumSha256: null,
              updatedAt: null
            },
            lifts: {
              status: "pending",
              featureCount: null,
              checksumSha256: null,
              updatedAt: null
            }
          }
        }
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("menu immutable version cloning", () => {
  it("creates next version clone and resets manual validation", async () => {
    const root = await mkdtemp(join(tmpdir(), "resorts-clone-"));
    try {
      const resortKey = "CA_Golden_Kicking_Horse";
      const v1Path = join(root, resortKey, "v1");
      const workspacePath = join(v1Path, "resort.json");
      const statusPath = join(v1Path, "status.json");

      await mkdir(v1Path, { recursive: true });
      await writeFile(
        workspacePath,
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: {
              name: "Kicking Horse",
              country: "CA"
            },
            selection: {
              osmType: "way",
              osmId: 476843455,
              displayName: "Kicking Horse Resort, Golden, Canada",
              center: [-116.96246, 51.29371],
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
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-21T00:00:00.000Z",
            manualValidation: {
              validated: true,
              validatedAt: "2026-02-21T00:10:00.000Z",
              validatedBy: "tester",
              notes: "approved"
            }
          },
          null,
          2
        ),
        "utf8"
      );

      const cloned = await createNextVersionClone({
        resortsRoot: root,
        resortKey,
        workspacePath,
        statusPath,
        createdAt: "2026-02-21T01:00:00.000Z"
      });

      expect(cloned.version).toBe("v2");
      expect(cloned.versionNumber).toBe(2);

      const v2StatusRaw = await readFile(cloned.statusPath, "utf8");
      const v2Status = JSON.parse(v2StatusRaw) as {
        version: string;
        createdAt: string;
        manualValidation: {
          validated: boolean;
          validatedAt: string | null;
          validatedBy: string | null;
          notes: string | null;
          layers: {
            boundary: { validated: boolean };
            runs: { validated: boolean };
            lifts: { validated: boolean };
          };
        };
      };
      expect(v2Status.version).toBe("v2");
      expect(v2Status.createdAt).toBe("2026-02-21T01:00:00.000Z");
      expect(v2Status.manualValidation).toEqual({
        validated: false,
        validatedAt: null,
        validatedBy: null,
        notes: null,
        layers: {
          boundary: { validated: false, validatedAt: null, validatedBy: null, notes: null },
          runs: { validated: false, validatedAt: null, validatedBy: null, notes: null },
          lifts: { validated: false, validatedAt: null, validatedBy: null, notes: null }
        }
      });

      const v1StatusRaw = await readFile(statusPath, "utf8");
      const v1Status = JSON.parse(v1StatusRaw) as {
        version: string;
        manualValidation: { validated: boolean };
      };
      expect(v1Status.version).toBe("v1");
      expect(v1Status.manualValidation.validated).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("menu resort key canonicalization", () => {
  it("converts legacy lowercase key to canonical key", () => {
    expect(toCanonicalResortKey("CA_golden_kicking_horse")).toBe("CA_Golden_Kicking_Horse");
    expect(toCanonicalResortKey("ca_morin_heights_kicking_horse")).toBe("CA_Morin_Heights_Kicking_Horse");
  });

  it("renames legacy resort folders to canonical names", async () => {
    const root = await mkdtemp(join(tmpdir(), "resorts-canonicalize-"));
    try {
      await mkdir(join(root, "CA_golden_kicking_horse", "v1"), { recursive: true });
      await canonicalizeResortKeys(root);
      const result = await listKnownResorts(root);
      expect(result[0]?.resortKey).toBe("CA_Golden_Kicking_Horse");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("menu sync preflight", () => {
  it("requires boundary complete with artifact path before runs/lifts sync", () => {
    expect(
      isBoundaryReadyForSync({
        schemaVersion: "2.0.0",
        resort: {
          query: {
            name: "Kicking Horse",
            country: "CA"
          }
        },
        layers: {
          boundary: { status: "pending" },
          lifts: { status: "pending" },
          runs: { status: "pending" }
        }
      })
    ).toBe(false);

    expect(
      isBoundaryReadyForSync({
        schemaVersion: "2.0.0",
        resort: {
          query: {
            name: "Kicking Horse",
            country: "CA"
          }
        },
        layers: {
          boundary: {
            status: "complete",
            artifactPath: "resorts/CA_Golden_Kicking_Horse/v1/boundary.geojson"
          },
          lifts: { status: "pending" },
          runs: { status: "pending" }
        }
      })
    ).toBe(true);
  });
});

describe("menu manual layer validation", () => {
  it("normalizes manual validation defaults with layer states", () => {
    const normalized = toManualValidationState(undefined);
    expect(normalized.validated).toBe(false);
    expect(normalized.layers.boundary.validated).toBe(false);
    expect(normalized.layers.runs.validated).toBe(false);
    expect(normalized.layers.lifts.validated).toBe(false);
  });

  it("updates layer validation and computes overall validation", () => {
    const afterBoundary = setLayerManualValidation({
      current: undefined,
      layer: "boundary",
      validated: true,
      validatedAt: "2026-02-21T12:00:00.000Z",
      validatedBy: "qa",
      notes: "ok"
    });
    expect(afterBoundary.layers.boundary.validated).toBe(true);
    expect(afterBoundary.validated).toBe(false);

    const afterRuns = setLayerManualValidation({
      current: afterBoundary,
      layer: "runs",
      validated: true,
      validatedAt: "2026-02-21T12:05:00.000Z",
      validatedBy: "qa",
      notes: "ok"
    });
    expect(afterRuns.validated).toBe(false);

    const afterLifts = setLayerManualValidation({
      current: afterRuns,
      layer: "lifts",
      validated: true,
      validatedAt: "2026-02-21T12:10:00.000Z",
      validatedBy: "qa",
      notes: "ok"
    });
    expect(afterLifts.validated).toBe(true);
    expect(afterLifts.validatedAt).toBe("2026-02-21T12:10:00.000Z");

    const afterInvalidateRuns = setLayerManualValidation({
      current: afterLifts,
      layer: "runs",
      validated: false,
      validatedAt: null,
      validatedBy: null,
      notes: null
    });
    expect(afterInvalidateRuns.validated).toBe(false);
    expect(afterInvalidateRuns.validatedAt).toBeNull();
  });
});

describe("menu interactive flows", () => {
  it("creates a new resort via menu flow", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-create-"));
    const rl = createFakeReadline(["2", "Kicking Horse", "CA", "Golden", "1", "3"]);
    try {
      await runInteractiveMenu({
        resortsRoot: root,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((candidate) => ({
            candidate,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: [
            {
              osmType: "node",
              osmId: 7248641928,
              displayName: "Kicking Horse, Golden, Canada",
              countryCode: "ca",
              country: "Canada",
              region: "British Columbia",
              center: [-116.96246, 51.29371],
              importance: 0.8,
              source: "nominatim"
            }
          ]
        })
      });

      const known = await listKnownResorts(root);
      expect(known).toHaveLength(1);
      expect(known[0]?.resortKey).toBe("CA_Golden_Kicking_Horse");
      expect(known[0]?.latestVersion).toBe("v1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cancels duplicate resort creation when user selects cancel", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-duplicate-"));
    const candidate = {
      osmType: "node" as const,
      osmId: 7248641928,
      displayName: "Kicking Horse, Golden, Canada",
      countryCode: "ca",
      country: "Canada",
      region: "British Columbia",
      center: [-116.96246, 51.29371] as [number, number],
      importance: 0.8,
      source: "nominatim" as const
    };
    const rl = createFakeReadline(["2", "Kicking Horse", "CA", "Golden", "1", "2", "3"]);
    try {
      await persistResortVersion({
        resortsRoot: root,
        countryCode: "CA",
        town: "Golden",
        resortName: "Kicking Horse",
        candidate
      });

      await runInteractiveMenu({
        resortsRoot: root,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: [candidate]
        })
      });

      const known = await listKnownResorts(root);
      expect(known).toHaveLength(1);
      expect(known[0]?.latestVersion).toBe("v1");
      expect(known[0]?.latestVersionNumber).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enters known resort menu and returns back to main menu", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-known-resort-"));
    const candidate = {
      osmType: "node" as const,
      osmId: 7248641928,
      displayName: "Kicking Horse, Golden, Canada",
      countryCode: "ca",
      country: "Canada",
      region: "British Columbia",
      center: [-116.96246, 51.29371] as [number, number],
      importance: 0.8,
      source: "nominatim" as const
    };
    const rl = createFakeReadline(["1", "1", "10", "3"]);
    try {
      await persistResortVersion({
        resortsRoot: root,
        countryCode: "CA",
        town: "Golden",
        resortName: "Kicking Horse",
        candidate
      });

      await runInteractiveMenu({
        resortsRoot: root,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: [candidate]
        })
      });
      expect(rl.prompts.some((prompt) => prompt.includes("Select option (1-14):"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deletes selected resort and related published artifacts from menu", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-delete-resort-"));
    const publicRoot = await mkdtemp(join(tmpdir(), "menu-flow-delete-public-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const rl = createFakeReadline(["1", "1", "12", `DELETE ${resortKey}`, "3"]);
    try {
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        join(versionPath, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "pending" },
            runs: { status: "pending" },
            lifts: { status: "pending" }
          }
        }),
        "utf8"
      );
      await writeFile(
        join(versionPath, "status.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          resortKey,
          version: "v1",
          createdAt: "2026-02-19T16:31:09.346Z",
          query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
          readiness: { overall: "incomplete", issues: [] },
          manualValidation: { validated: false }
        }),
        "utf8"
      );

      await mkdir(join(publicRoot, "packs", resortKey), { recursive: true });
      await writeFile(join(publicRoot, "packs", resortKey, "base.pmtiles"), new Uint8Array([1, 2, 3]));
      await writeFile(join(publicRoot, "packs", resortKey, "style.json"), JSON.stringify({ version: 8 }), "utf8");
      await writeFile(
        join(publicRoot, "packs", `${resortKey}.latest.validated.json`),
        JSON.stringify({ schemaVersion: "1.0.0" }),
        "utf8"
      );
      await mkdir(join(publicRoot, "resort-packs"), { recursive: true });
      await writeFile(
        join(publicRoot, "resort-packs", "index.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          resorts: [
            {
              resortId: resortKey,
              resortName: "Kicking Horse",
              versions: [
                {
                  version: "v1",
                  approved: true,
                  packUrl: `/packs/${resortKey}.latest.validated.json`,
                  createdAt: "2026-02-20T10:00:00.000Z"
                }
              ]
            }
          ]
        }),
        "utf8"
      );

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        searchFn: async () => ({
          query: { name: "unused", country: "CA", limit: 5 },
          candidates: []
        })
      });

      await expect(stat(join(root, resortKey))).rejects.toBeDefined();
      await expect(stat(join(publicRoot, "packs", resortKey, "base.pmtiles"))).rejects.toBeDefined();
      await expect(stat(join(publicRoot, "packs", `${resortKey}.latest.validated.json`))).rejects.toBeDefined();
      const catalogRaw = await readFile(join(publicRoot, "resort-packs", "index.json"), "utf8");
      const catalog = JSON.parse(catalogRaw) as { resorts: Array<{ resortId: string }> };
      expect(catalog.resorts.some((entry) => entry.resortId === resortKey)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(publicRoot, { recursive: true, force: true });
    }
  });

  it("unpublishes selected resort artifacts without deleting resort data", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-unpublish-resort-"));
    const publicRoot = await mkdtemp(join(tmpdir(), "menu-flow-unpublish-public-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const rl = createFakeReadline(["1", "1", "13", `UNPUBLISH ${resortKey}`, "10", "3"]);
    try {
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        join(versionPath, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "pending" },
            runs: { status: "pending" },
            lifts: { status: "pending" }
          }
        }),
        "utf8"
      );
      await writeFile(
        join(versionPath, "status.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          resortKey,
          version: "v1",
          createdAt: "2026-02-19T16:31:09.346Z",
          query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
          readiness: { overall: "incomplete", issues: [] },
          manualValidation: { validated: false }
        }),
        "utf8"
      );

      await mkdir(join(publicRoot, "packs", resortKey), { recursive: true });
      await writeFile(join(publicRoot, "packs", resortKey, "base.pmtiles"), new Uint8Array([1, 2, 3]));
      await writeFile(join(publicRoot, "packs", resortKey, "style.json"), JSON.stringify({ version: 8 }), "utf8");
      await writeFile(
        join(publicRoot, "packs", `${resortKey}.latest.validated.json`),
        JSON.stringify({ schemaVersion: "1.0.0" }),
        "utf8"
      );
      await mkdir(join(publicRoot, "resort-packs"), { recursive: true });
      await writeFile(
        join(publicRoot, "resort-packs", "index.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          resorts: [
            {
              resortId: resortKey,
              resortName: "Kicking Horse",
              versions: [
                {
                  version: "v1",
                  approved: true,
                  packUrl: `/packs/${resortKey}.latest.validated.json`,
                  createdAt: "2026-02-20T10:00:00.000Z"
                }
              ]
            }
          ]
        }),
        "utf8"
      );

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        searchFn: async () => ({
          query: { name: "unused", country: "CA", limit: 5 },
          candidates: []
        })
      });

      await expect(stat(join(root, resortKey))).resolves.toBeDefined();
      await expect(stat(join(publicRoot, "packs", resortKey, "base.pmtiles"))).rejects.toBeDefined();
      await expect(stat(join(publicRoot, "packs", `${resortKey}.latest.validated.json`))).rejects.toBeDefined();
      const catalogRaw = await readFile(join(publicRoot, "resort-packs", "index.json"), "utf8");
      const catalog = JSON.parse(catalogRaw) as {
        schemaVersion: string;
        release?: {
          channel?: string;
          manifestUrl?: string;
          manifestSha256?: string;
        };
        resorts: Array<{ resortId: string }>;
      };
      expect(catalog.schemaVersion).toBe("2.0.0");
      expect(catalog.release?.channel).toBe("stable");
      expect(catalog.release?.manifestUrl).toBe("/releases/stable-manifest.json");
      expect(catalog.release?.manifestSha256).toMatch(/^[a-f0-9]{64}$/iu);
      expect(catalog.resorts.some((entry) => entry.resortId === resortKey)).toBe(false);
      const manifestRaw = await readFile(join(publicRoot, "releases", "stable-manifest.json"), "utf8");
      const manifest = JSON.parse(manifestRaw) as {
        schemaVersion: string;
        artifacts: Array<{ resortId?: string }>;
      };
      expect(manifest.schemaVersion).toBe("1.0.0");
      expect(manifest.artifacts.some((artifact) => artifact.resortId === resortKey)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(publicRoot, { recursive: true, force: true });
    }
  });

  it("auto-publishes to app catalog when all layer validations become yes", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-auto-publish-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const basemapDir = join(versionPath, "basemap");
    const workspacePath = join(versionPath, "resort.json");
    const statusPath = join(versionPath, "status.json");
    const rl = createFakeReadline([
      "1",
      "1",
      "6",
      "y",
      "Enrico",
      "",
      "7",
      "y",
      "Enrico",
      "",
      "8",
      "y",
      "Enrico",
      "",
      "10",
      "3"
    ]);
    try {
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        workspacePath,
        JSON.stringify(
          {
            schemaVersion: "2.0.0",
            resort: {
              query: { name: "Kicking Horse", country: "CA" }
            },
            layers: {
              boundary: { status: "complete", artifactPath: "boundary.geojson", featureCount: 1 },
              runs: { status: "complete", artifactPath: "runs.geojson", featureCount: 72 },
              lifts: { status: "complete", artifactPath: "lifts.geojson", featureCount: 7 }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-19T16:31:09.346Z",
            query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
            readiness: { overall: "ready", issues: [] },
            manualValidation: {
              validated: false,
              layers: {
                boundary: { validated: false },
                runs: { validated: false },
                lifts: { validated: false }
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(join(versionPath, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(versionPath, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(basemapDir, { recursive: true });
      await writeFile(join(basemapDir, "base.pmtiles"), new Uint8Array([7, 8, 9, 10]));
      await writeFile(
        join(basemapDir, "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: []
        })
      });

      const catalogRaw = await readFile(join(publicRoot, "resort-packs", "index.json"), "utf8");
      const catalog = JSON.parse(catalogRaw) as {
        resorts: Array<{
          resortId: string;
          versions: Array<{ approved: boolean; packUrl: string }>;
        }>;
      };

      expect(catalog.resorts[0]?.resortId).toBe(resortKey);
      expect(catalog.resorts[0]?.versions[0]?.approved).toBe(true);
      expect(catalog.resorts[0]?.versions[0]?.packUrl).toBe(`/packs/${resortKey}.latest.validated.json`);
      const publishedPmtiles = await readFile(join(publicRoot, "packs", resortKey, "base.pmtiles"));
      const publishedStyle = await readFile(join(publicRoot, "packs", resortKey, "style.json"), "utf8");
      expect([...publishedPmtiles]).toEqual([7, 8, 9, 10]);
      expect(JSON.parse(publishedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not auto-publish when manual validation is yes but readiness is incomplete", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-auto-publish-not-ready-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const workspacePath = join(versionPath, "resort.json");
    const statusPath = join(versionPath, "status.json");
    const rl = createFakeReadline([
      "1",
      "1",
      "6",
      "y",
      "Enrico",
      "",
      "7",
      "y",
      "Enrico",
      "",
      "8",
      "y",
      "Enrico",
      "",
      "10",
      "3"
    ]);
    try {
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        workspacePath,
        JSON.stringify(
          {
            schemaVersion: "2.0.0",
            resort: {
              query: { name: "Nakiska Ski Area", country: "CA" }
            },
            layers: {
              boundary: { status: "complete", artifactPath: "boundary.geojson", featureCount: 1 },
              runs: { status: "complete", artifactPath: "runs.geojson", featureCount: 2 },
              lifts: { status: "complete", artifactPath: "lifts.geojson", featureCount: 0 }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-19T16:31:09.346Z",
            query: { name: "Nakiska Ski Area", countryCode: "CA", town: "Kananaskis" },
            readiness: { overall: "incomplete", issues: ["lifts: featureCount must be >= 1"] },
            manualValidation: {
              validated: false,
              layers: {
                boundary: { validated: false },
                runs: { validated: false },
                lifts: { validated: false }
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-115.16, 50.94],
                [-115.14, 50.94],
                [-115.14, 50.95],
                [-115.16, 50.95],
                [-115.16, 50.94]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(join(versionPath, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(versionPath, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Nakiska Ski Area", country: "CA", limit: 5 },
          candidates: []
        })
      });

      await expect(stat(join(publicRoot, "resort-packs", "index.json"))).rejects.toBeDefined();
      await expect(stat(join(publicRoot, "packs", `${resortKey}.latest.validated.json`))).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("publishes immediately after basemap generation when version is already validated", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-basemap-publish-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const workspacePath = join(versionPath, "resort.json");
    const statusPath = join(versionPath, "status.json");
    const rl = createFakeReadline(["1", "1", "9", "1", "10", "3"]);
    try {
      await mkdir(versionPath, { recursive: true });
      await mkdir(join(root, resortKey, "basemap"), { recursive: true });
      await writeFile(join(root, resortKey, "basemap", "base.pmtiles"), new Uint8Array([5, 6, 7, 8]));
      await writeFile(
        join(root, resortKey, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await writeFile(
        workspacePath,
        JSON.stringify(
          {
            schemaVersion: "2.0.0",
            resort: {
              query: { name: "Kicking Horse", country: "CA" }
            },
            layers: {
              boundary: { status: "complete", artifactPath: "boundary.geojson", featureCount: 1 },
              runs: { status: "complete", artifactPath: "runs.geojson", featureCount: 72 },
              lifts: { status: "complete", artifactPath: "lifts.geojson", featureCount: 7 }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-19T16:31:09.346Z",
            query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
            readiness: { overall: "ready", issues: [] },
            manualValidation: {
              validated: true,
              layers: {
                boundary: { validated: true },
                runs: { validated: true },
                lifts: { validated: true }
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(join(versionPath, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(versionPath, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: []
        })
      });

      const catalogRaw = await readFile(join(publicRoot, "resort-packs", "index.json"), "utf8");
      const catalog = JSON.parse(catalogRaw) as {
        resorts: Array<{ resortId: string; versions: Array<{ approved: boolean; packUrl: string }> }>;
      };
      expect(catalog.resorts[0]?.resortId).toBe(resortKey);
      expect(catalog.resorts[0]?.versions[0]?.approved).toBe(true);
      expect(catalog.resorts[0]?.versions[0]?.packUrl).toBe(`/packs/${resortKey}.latest.validated.json`);

      const publishedPmtiles = await readFile(join(publicRoot, "packs", resortKey, "base.pmtiles"));
      const publishedStyle = await readFile(join(publicRoot, "packs", resortKey, "style.json"), "utf8");
      expect([...publishedPmtiles]).toEqual([5, 6, 7, 8]);
      expect(JSON.parse(publishedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("guides shared basemap setup during generation when source is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-basemap-guided-"));
    const sourceRoot = await mkdtemp(join(tmpdir(), "menu-flow-basemap-source-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const workspacePath = join(versionPath, "resort.json");
    const statusPath = join(versionPath, "status.json");
    const sourcePmtiles = join(sourceRoot, "base.pmtiles");
    const sourceStyle = join(sourceRoot, "style.json");
    const configPath = join(root, "basemap-provider.json");
    const rl = createFakeReadline(["1", "1", "9", "1", "10", "3"]);
    const originalEnv = { ...process.env };
    try {
      await writeFile(sourcePmtiles, new Uint8Array([11, 22, 33, 44]));
      await writeFile(
        sourceStyle,
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: `cp '${sourcePmtiles}' {outputPmtiles} && cp '${sourceStyle}' {outputStyle}`
        }),
        "utf8"
      );
      process.env.PTK_BASEMAP_CONFIG_PATH = configPath;
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        workspacePath,
        JSON.stringify(
          {
            schemaVersion: "2.0.0",
            resort: {
              query: { name: "Kicking Horse", country: "CA" }
            },
            layers: {
              boundary: { status: "complete", artifactPath: "boundary.geojson", featureCount: 1 },
              runs: { status: "complete", artifactPath: "runs.geojson", featureCount: 72 },
              lifts: { status: "complete", artifactPath: "lifts.geojson", featureCount: 7 }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-19T16:31:09.346Z",
            query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
            readiness: { overall: "ready", issues: [] },
            manualValidation: {
              validated: true,
              layers: {
                boundary: { validated: true },
                runs: { validated: true },
                lifts: { validated: true }
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(join(versionPath, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(versionPath, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: []
        })
      });

      const sharedPmtiles = await readFile(join(root, resortKey, "basemap", "base.pmtiles"));
      const sharedStyle = JSON.parse(await readFile(join(root, resortKey, "basemap", "style.json"), "utf8")) as {
        sources?: Record<string, { type?: string }>;
      };
      expect([...sharedPmtiles]).toEqual([11, 22, 33, 44]);
      expect(sharedStyle.sources?.basemap?.type).toBe("vector");

      const publishedPmtiles = await readFile(join(publicRoot, "packs", resortKey, "base.pmtiles"));
      const publishedStyle = JSON.parse(await readFile(join(publicRoot, "packs", resortKey, "style.json"), "utf8")) as {
        sources?: Record<string, { type?: string }>;
      };
      expect([...publishedPmtiles]).toEqual([11, 22, 33, 44]);
      expect(publishedStyle.sources?.basemap?.type).toBe("vector");
    } finally {
      restoreProcessEnv(originalEnv);
      await rm(root, { recursive: true, force: true });
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });

  it("generates default offline style when provider command only outputs pmtiles", async () => {
    const root = await mkdtemp(join(tmpdir(), "menu-flow-basemap-default-style-"));
    const sourceRoot = await mkdtemp(join(tmpdir(), "menu-flow-basemap-source-pmtiles-only-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";
    const versionPath = join(root, resortKey, "v1");
    const workspacePath = join(versionPath, "resort.json");
    const statusPath = join(versionPath, "status.json");
    const sourcePmtiles = join(sourceRoot, "base.pmtiles");
    const configPath = join(root, "basemap-provider.json");
    const rl = createFakeReadline(["1", "1", "9", "1", "10", "3"]);
    const originalEnv = { ...process.env };
    try {
      await writeFile(sourcePmtiles, new Uint8Array([44, 33, 22, 11]));
      await writeFile(
        configPath,
        JSON.stringify({
          provider: "openmaptiles-planetiler",
          bufferMeters: 1000,
          maxZoom: 15,
          planetilerCommand: `cp '${sourcePmtiles}' {outputPmtiles}`
        }),
        "utf8"
      );
      process.env.PTK_BASEMAP_CONFIG_PATH = configPath;
      await mkdir(versionPath, { recursive: true });
      await writeFile(
        workspacePath,
        JSON.stringify(
          {
            schemaVersion: "2.0.0",
            resort: {
              query: { name: "Kicking Horse", country: "CA" }
            },
            layers: {
              boundary: { status: "complete", artifactPath: "boundary.geojson", featureCount: 1 },
              runs: { status: "complete", artifactPath: "runs.geojson", featureCount: 72 },
              lifts: { status: "complete", artifactPath: "lifts.geojson", featureCount: 7 }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        statusPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            resortKey,
            version: "v1",
            createdAt: "2026-02-19T16:31:09.346Z",
            query: { name: "Kicking Horse", countryCode: "CA", town: "Golden" },
            readiness: { overall: "ready", issues: [] },
            manualValidation: {
              validated: true,
              layers: {
                boundary: { validated: true },
                runs: { validated: true },
                lifts: { validated: true }
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(versionPath, "boundary.geojson"),
        JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-116.97, 51.29],
                [-116.95, 51.29],
                [-116.95, 51.31],
                [-116.97, 51.31],
                [-116.97, 51.29]
              ]
            ]
          },
          properties: {}
        }),
        "utf8"
      );
      await writeFile(join(versionPath, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(versionPath, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

      await runInteractiveMenu({
        resortsRoot: root,
        appPublicRoot: publicRoot,
        rl,
        rankCandidatesFn: async (candidates) =>
          candidates.map((entry) => ({
            candidate: entry,
            hasPolygonGeometry: false
          })),
        searchFn: async () => ({
          query: { name: "Kicking Horse", country: "CA", limit: 5 },
          candidates: []
        })
      });

      const sharedStyle = JSON.parse(await readFile(join(root, resortKey, "basemap", "style.json"), "utf8")) as {
        sources?: Record<string, { type?: string; url?: string }>;
        layers?: Array<{
          id?: string;
          ["source-layer"]?: string;
          type?: string;
          minzoom?: number;
          layout?: Record<string, unknown>;
        }>;
      };
      expect(sharedStyle.sources?.basemap?.type).toBe("vector");
      expect(sharedStyle.sources?.basemap?.url).toBe("pmtiles://./base.pmtiles");
      const layerIds = (sharedStyle.layers ?? []).map((layer) => layer.id);
      expect(layerIds).toEqual(
        expect.arrayContaining(["water", "waterway", "water-name", "transportation", "boundary"])
      );
      const waterwayLayer = (sharedStyle.layers ?? []).find((layer) => layer.id === "waterway");
      expect(waterwayLayer?.["source-layer"]).toBe("waterway");
      const waterNameLayer = (sharedStyle.layers ?? []).find((layer) => layer.id === "water-name");
      expect(waterNameLayer?.["source-layer"]).toBe("water_name");
      expect(waterNameLayer?.type).toBe("symbol");
      expect(waterNameLayer?.minzoom).toBe(11);
      expect(waterNameLayer?.layout?.["symbol-placement"]).toBe("line");
    } finally {
      restoreProcessEnv(originalEnv);
      await rm(root, { recursive: true, force: true });
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });
});

function createFakeReadline(answers: string[]): { question: (query: string) => Promise<string>; close: () => void; prompts: string[] } {
  const prompts: string[] = [];
  let index = 0;
  return {
    prompts,
    async question(query: string): Promise<string> {
      prompts.push(query);
      const answer = answers[index];
      if (answer === undefined) {
        throw new Error(`No test answer available for prompt: ${query}`);
      }
      index += 1;
      return answer;
    },
    close(): void {
      // External readline injected in tests; no-op on close.
    }
  };
}

function restoreProcessEnv(snapshot: Record<string, string | undefined>): void {
  const keys = new Set([...Object.keys(process.env), ...Object.keys(snapshot)]);
  for (const key of keys) {
    const nextValue = snapshot[key];
    if (nextValue === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = nextValue;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
