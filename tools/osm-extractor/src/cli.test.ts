import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  auditPublishedResortIntegrity,
  CliCommandError,
  exportLatestValidatedResortVersion,
  formatCliError,
  isCliEntryPointUrl,
  parseResortUpdateOptions,
  publishLatestValidatedResortVersion,
  runReleaseDryRun,
  runReleaseGoNoGoGate,
  runResortUpdateCommand
} from "./cli.js";

describe("CLI error JSON format", () => {
  it("formats explicit command errors with code and details", () => {
    const result = formatCliError(
      new CliCommandError("INVALID_FLAG_VALUE", "Flag --bbox expects min values <= max values.", {
        flag: "--bbox",
        expected: "min<=max",
        value: "8,45,7,44"
      }),
      "ingest-osm"
    );

    expect(result).toEqual({
      ok: false,
      error: {
        command: "ingest-osm",
        code: "INVALID_FLAG_VALUE",
        message: "Flag --bbox expects min values <= max values.",
        details: {
          flag: "--bbox",
          expected: "min<=max",
          value: "8,45,7,44"
        }
      }
    });
  });

  it("formats unexpected failures with generic command failure code", () => {
    const result = formatCliError(new Error("unexpected failure"), "build-pack");
    expect(result).toEqual({
      ok: false,
      error: {
        command: "build-pack",
        code: "COMMAND_FAILED",
        message: "unexpected failure"
      }
    });
  });
});

describe("CLI entrypoint detection", () => {
  it("matches import URL when entry path is relative", () => {
    const importMetaUrl = "file:///repo/tools/osm-extractor/dist/src/cli.js";
    const result = isCliEntryPointUrl({
      importMetaUrl,
      entryPath: "/repo/tools/osm-extractor/dist/src/../src/cli.js"
    });
    expect(result).toBe(true);
  });
});

describe("resort-update option parsing", () => {
  it("parses valid lifts layer options", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "lifts",
      "--buffer-meters",
      "40",
      "--timeout-seconds",
      "25"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "lifts",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: 40,
      timeoutSeconds: 25,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: false
    });
  });

  it("parses dry-run flag", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "runs",
      "--dry-run"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "runs",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: undefined,
      timeoutSeconds: undefined,
      updatedAt: undefined,
      dryRun: true,
      requireComplete: false
    });
  });

  it("parses require-complete flag", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "runs",
      "--require-complete"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "runs",
      outputPath: undefined,
      index: undefined,
      searchLimit: undefined,
      bufferMeters: undefined,
      timeoutSeconds: undefined,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: true
    });
  });

  it("parses layer all with required boundary index", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "all",
      "--index",
      "2",
      "--search-limit",
      "6",
      "--buffer-meters",
      "100",
      "--timeout-seconds",
      "40"
    ]);

    expect(result).toEqual({
      workspacePath: "/tmp/resort.json",
      layer: "all",
      outputPath: undefined,
      index: 2,
      searchLimit: 6,
      bufferMeters: 100,
      timeoutSeconds: 40,
      updatedAt: undefined,
      dryRun: false,
      requireComplete: false
    });
  });

  it("allows layer all dry-run without boundary index", () => {
    const result = parseResortUpdateOptions([
      "--workspace",
      "/tmp/resort.json",
      "--layer",
      "all",
      "--dry-run"
    ]);

    expect(result.layer).toBe("all");
    expect(result.index).toBeUndefined();
    expect(result.dryRun).toBe(true);
  });

  it("rejects boundary layer when index is missing", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "boundary"
      ])
    ).toThrow(/requires --index/i);
  });

  it("rejects lifts/runs layer with boundary-only flags", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "runs",
        "--index",
        "1"
      ])
    ).toThrow(/does not accept --index or --search-limit/i);
  });

  it("rejects boundary layer with run/lift-only flags", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "boundary",
        "--index",
        "1",
        "--buffer-meters",
        "20"
      ])
    ).toThrow(/does not accept --buffer-meters or --timeout-seconds/i);
  });

  it("throws INVALID_FLAG_COMBINATION code for mixed layer flags", () => {
    try {
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "runs",
        "--search-limit",
        "3"
      ]);
      throw new Error("Expected parseResortUpdateOptions to throw.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CliCommandError);
      const commandError = error as CliCommandError;
      expect(commandError.code).toBe("INVALID_FLAG_COMBINATION");
    }
  });

  it("rejects layer all without boundary index in non-dry-run mode", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "all"
      ])
    ).toThrow(/requires --index/i);
  });

  it("rejects layer all with --output", () => {
    expect(() =>
      parseResortUpdateOptions([
        "--workspace",
        "/tmp/resort.json",
        "--layer",
        "all",
        "--index",
        "1",
        "--output",
        "/tmp/file.geojson"
      ])
    ).toThrow(/does not accept --output/i);
  });
});

describe("resort-update command behavior", () => {
  it("prints text batch summary for --layer all", async () => {
    const log = vi.fn();
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: true,
      issues: [],
      results: [
        {
          workspacePath: "/tmp/resort.json",
          layer: "boundary",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/boundary.geojson",
            featureCount: 1,
            checksumSha256: "sha-b",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "boundary" }
        },
        {
          workspacePath: "/tmp/resort.json",
          layer: "lifts",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/lifts.geojson",
            featureCount: 10,
            checksumSha256: "sha-l",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "lifts" }
        },
        {
          workspacePath: "/tmp/resort.json",
          layer: "runs",
          dryRun: false,
          before: { status: "pending", artifactPath: null, featureCount: null, checksumSha256: null, updatedAt: null, error: null },
          after: {
            status: "complete",
            artifactPath: "/tmp/runs.geojson",
            featureCount: 22,
            checksumSha256: "sha-r",
            updatedAt: "2026-02-20T00:00:00.000Z",
            error: null
          },
          readiness: { ready: true, issues: [] },
          changed: true,
          changedFields: ["status"],
          operation: { kind: "runs" }
        }
      ]
    });

    await runResortUpdateCommand(
      ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1"],
      false,
      { updateResortLayersFn, log }
    );

    expect(log).toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toMatch(/RESORT_UPDATED_BATCH workspace=\/tmp\/resort.json/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/boundary changed=yes ready=yes/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/lifts changed=yes ready=yes/);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toMatch(/runs changed=yes ready=yes/);
  });

  it("throws UPDATE_INCOMPLETE for --layer all with --require-complete in text mode", async () => {
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: false,
      issues: ["runs: featureCount must be >= 1"],
      results: []
    });

    await expect(
      runResortUpdateCommand(
        ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1", "--require-complete"],
        false,
        { updateResortLayersFn, log: vi.fn() }
      )
    ).rejects.toMatchObject({ code: "UPDATE_INCOMPLETE" });
  });

  it("throws UPDATE_INCOMPLETE for --layer all with --require-complete in JSON mode", async () => {
    const updateResortLayersFn = vi.fn().mockResolvedValue({
      workspacePath: "/tmp/resort.json",
      layerSelection: "all",
      dryRun: false,
      overallReady: false,
      issues: ["runs: featureCount must be >= 1"],
      results: []
    });

    await expect(
      runResortUpdateCommand(
        ["--workspace", "/tmp/resort.json", "--layer", "all", "--index", "1", "--require-complete"],
        true,
        { updateResortLayersFn, log: vi.fn() }
      )
    ).rejects.toMatchObject({ code: "UPDATE_INCOMPLETE" });
  });
});

describe("resort-export-latest command helpers", () => {
  it("exports latest manually validated resort version bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-export-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v1 = join(root, resortKey, "v1");
    const v2 = join(root, resortKey, "v2");
    const outputPath = join(root, "exports", "bundle.json");

    try {
      await mkdir(v1, { recursive: true });
      await mkdir(v2, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: false }
        }),
        "utf8"
      );
      await writeFile(
        join(v2, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v2, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" }
          },
          layers: {
            boundary: { status: "complete", artifactPath: "resorts/CA_golden_kicking_horse/v2/boundary.geojson" },
            areas: { status: "complete", artifactPath: "resorts/CA_golden_kicking_horse/v2/areas.geojson" },
            lifts: { status: "complete", artifactPath: "resorts/CA_golden_kicking_horse/v2/lifts.geojson" },
            runs: { status: "complete", artifactPath: "resorts/CA_golden_kicking_horse/v2/runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v2, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v2, "areas.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v2, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v2, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

      const result = await exportLatestValidatedResortVersion({
        resortsRoot: root,
        resortKey,
        outputPath,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      expect(result.version).toBe("v2");
      expect(result.validatedAt).toBe("2026-02-21T10:00:00.000Z");

      const exportedRaw = await readFile(outputPath, "utf8");
      const exported = JSON.parse(exportedRaw) as {
        export: { version: string; resortKey: string };
        layers: { boundary: unknown; areas?: unknown; runs: unknown; lifts: unknown };
      };
      expect(exported.export.version).toBe("v2");
      expect(exported.export.resortKey).toBe(resortKey);
      expect(exported.layers.boundary).not.toBeNull();
      expect(exported.layers.areas).not.toBeNull();
      expect(exported.layers.runs).not.toBeNull();
      expect(exported.layers.lifts).not.toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("throws when no manually validated version exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-export-none-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v1 = join(root, resortKey, "v1");
    const outputPath = join(root, "bundle.json");

    try {
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: false }
        }),
        "utf8"
      );

      await expect(
        exportLatestValidatedResortVersion({
          resortsRoot: root,
          resortKey,
          outputPath
        })
      ).rejects.toThrow(/No manually validated ready version found/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("skips manually validated versions that are not readiness-complete", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-export-not-ready-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v2 = join(root, resortKey, "v2");
    const outputPath = join(root, "bundle.json");

    try {
      await mkdir(v2, { recursive: true });
      await writeFile(
        join(v2, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "incomplete", issues: ["lifts: featureCount must be >= 1"] }
        }),
        "utf8"
      );

      await expect(
        exportLatestValidatedResortVersion({
          resortsRoot: root,
          resortKey,
          outputPath
        })
      ).rejects.toThrow(/No manually validated ready version found/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("resort-publish-latest command helpers", () => {
  it("publishes latest manually validated resort version and updates app catalog", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-publish-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v2 = join(root, "resorts", resortKey, "v2");
    const basemapDir = join(v2, "basemap");
    const publicRoot = join(root, "public");

    try {
      await mkdir(v2, { recursive: true });
      await writeFile(
        join(v2, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v2, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" }
          },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v2, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v2, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v2, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(basemapDir, { recursive: true });
      await writeFile(join(basemapDir, "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(basemapDir, "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );

      const published = await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      expect(published.version).toBe("v2");
      expect(published.outputUrl).toBe("/packs/CA_Golden_Kicking_Horse.latest.validated.json");

      const catalogRaw = await readFile(join(publicRoot, "resort-packs", "index.json"), "utf8");
      const catalog = JSON.parse(catalogRaw) as {
        schemaVersion: string;
        release?: {
          channel: string;
          appVersion: string;
          manifestUrl: string;
          manifestSha256: string;
          createdAt: string;
        };
        resorts: Array<{
          resortId: string;
          resortName: string;
          versions: Array<{
            version: string;
            approved: boolean;
            packUrl: string;
            compatibility?: {
              minAppVersion: string;
              supportedPackSchemaVersions?: string[];
            };
            checksums?: {
              packSha256: string;
              pmtilesSha256: string;
              styleSha256: string;
            };
          }>;
        }>;
      };
      expect(catalog.schemaVersion).toBe("2.0.0");
      expect(catalog.release?.channel).toBe("stable");
      expect(catalog.release?.manifestUrl).toBe("/releases/stable-manifest.json");
      expect(catalog.release?.manifestSha256).toMatch(/^[a-f0-9]{64}$/iu);
      expect(catalog.resorts).toHaveLength(1);
      expect(catalog.resorts[0]?.resortId).toBe(resortKey);
      expect(catalog.resorts[0]?.resortName).toBe("Kicking Horse");
      expect(catalog.resorts[0]?.versions[0]?.version).toBe("v2");
      expect(catalog.resorts[0]?.versions[0]?.approved).toBe(true);
      expect(catalog.resorts[0]?.versions[0]?.packUrl).toBe("/packs/CA_Golden_Kicking_Horse.latest.validated.json");
      expect(catalog.resorts[0]?.versions[0]?.compatibility?.minAppVersion).toBe("0.0.1");
      expect(catalog.resorts[0]?.versions[0]?.checksums?.packSha256).toMatch(/^[a-f0-9]{64}$/iu);
      const manifestRaw = await readFile(join(publicRoot, "releases", "stable-manifest.json"), "utf8");
      const manifest = JSON.parse(manifestRaw) as {
        schemaVersion: string;
        artifacts: Array<{ kind: string; resortId: string; version: string; url: string; sha256: string }>;
      };
      expect(manifest.schemaVersion).toBe("1.0.0");
      expect(manifest.artifacts.length).toBeGreaterThanOrEqual(3);
      expect(manifest.artifacts.some((artifact) => artifact.kind === "pack" && artifact.resortId === resortKey)).toBe(
        true
      );
      const publishedPmtiles = await readFile(join(publicRoot, "packs", resortKey, "base.pmtiles"));
      const publishedStyle = await readFile(join(publicRoot, "packs", resortKey, "style.json"), "utf8");
      expect([...publishedPmtiles]).toEqual([1, 2, 3, 4]);
      expect(JSON.parse(publishedStyle)).toEqual({
        version: 8,
        sources: { basemap: { type: "vector" } },
        layers: [{ id: "bg", type: "background" }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("resort-audit-published command helpers", () => {
  it("passes when catalog pack files and basemap assets are valid", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-audit-ok-"));
    const publicRoot = join(root, "public");
    const catalogDir = join(publicRoot, "resort-packs");
    const packsDir = join(publicRoot, "packs");
    const resortKey = "CA_Golden_Kicking_Horse";

    try {
      await mkdir(catalogDir, { recursive: true });
      await mkdir(join(packsDir, resortKey), { recursive: true });
      await writeFile(
        join(catalogDir, "index.json"),
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
                  createdAt: "2026-02-21T10:30:00.000Z"
                }
              ]
            }
          ]
        }),
        "utf8"
      );
      await writeFile(
        join(packsDir, `${resortKey}.latest.validated.json`),
        JSON.stringify({
          schemaVersion: "1.0.0",
          layers: {
            boundary: { type: "FeatureCollection", features: [] },
            runs: { type: "FeatureCollection", features: [] },
            lifts: { type: "FeatureCollection", features: [] }
          }
        }),
        "utf8"
      );
      await writeFile(join(packsDir, resortKey, "base.pmtiles"), new Uint8Array([1, 2, 3]));
      await writeFile(
        join(packsDir, resortKey, "style.json"),
        JSON.stringify({
          version: 8,
          sources: {
            basemap: {
              type: "vector",
              url: "pmtiles:///packs/CA_Golden_Kicking_Horse/base.pmtiles"
            }
          },
          layers: [{ id: "bg", type: "background" }]
        }),
        "utf8"
      );

      const result = await auditPublishedResortIntegrity({
        appPublicRoot: publicRoot
      });

      expect(result.overallOk).toBe(true);
      expect(result.resorts).toHaveLength(1);
      expect(result.resorts[0]?.ok).toBe(true);
      expect(result.resorts[0]?.issues).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports integrity issues for missing published artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "resort-audit-fail-"));
    const publicRoot = join(root, "public");
    const catalogDir = join(publicRoot, "resort-packs");
    const resortKey = "CA_Golden_Kicking_Horse";

    try {
      await mkdir(catalogDir, { recursive: true });
      await writeFile(
        join(catalogDir, "index.json"),
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
                  createdAt: "2026-02-21T10:30:00.000Z"
                }
              ]
            }
          ]
        }),
        "utf8"
      );

      const result = await auditPublishedResortIntegrity({
        appPublicRoot: publicRoot
      });

      expect(result.overallOk).toBe(false);
      expect(result.resorts).toHaveLength(1);
      expect(result.resorts[0]?.ok).toBe(false);
      expect(result.resorts[0]?.issues.join("\n")).toMatch(/missing published pack JSON/i);
      expect(result.resorts[0]?.issues.join("\n")).toMatch(/missing PMTiles file/i);
      expect(result.resorts[0]?.issues.join("\n")).toMatch(/Invalid basemap style JSON/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("release-go-no-go command helpers", () => {
  it("passes when latest resort versions are ready, validated, published, and manifest checksum matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-go-no-go-ok-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v1 = join(root, "resorts", resortKey, "v1");
    const basemapDir = join(v1, "basemap");
    const publicRoot = join(root, "public");

    try {
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: {
            query: { name: "Kicking Horse", country: "CA" }
          },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(basemapDir, { recursive: true });
      await writeFile(join(basemapDir, "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(basemapDir, "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );

      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      const gate = await runReleaseGoNoGoGate({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot
      });

      expect(gate.overallOk).toBe(true);
      expect(gate.globalIssues).toEqual([]);
      expect(gate.manifest.issues).toEqual([]);
      expect(gate.summary.resortsChecked).toBe(1);
      expect(gate.summary.readyValidatedCount).toBe(1);
      expect(gate.summary.publishReadyCount).toBe(1);
      expect(gate.resorts[0]?.resortKey).toBe(resortKey);
      expect(gate.resorts[0]?.ok).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when latest ready+validated version is not the published version", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-go-no-go-version-mismatch-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v1 = join(root, "resorts", resortKey, "v1");
    const v2 = join(root, "resorts", resortKey, "v2");
    const basemapDir = join(v1, "basemap");
    const publicRoot = join(root, "public");

    try {
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(basemapDir, { recursive: true });
      await writeFile(join(basemapDir, "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(basemapDir, "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );

      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      await mkdir(v2, { recursive: true });
      await writeFile(
        join(v2, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T11:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );

      const gate = await runReleaseGoNoGoGate({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot
      });

      expect(gate.overallOk).toBe(false);
      expect(gate.resorts[0]?.ok).toBe(false);
      expect(gate.resorts[0]?.issues.join("\n")).toMatch(/does not match latest version v2/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when stable manifest checksum does not match catalog metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-go-no-go-manifest-sha-"));
    const resortKey = "CA_Golden_Kicking_Horse";
    const v1 = join(root, "resorts", resortKey, "v1");
    const basemapDir = join(v1, "basemap");
    const publicRoot = join(root, "public");

    try {
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(basemapDir, { recursive: true });
      await writeFile(join(basemapDir, "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(basemapDir, "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );

      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      await writeFile(join(publicRoot, "releases", "stable-manifest.json"), "{\"mutated\":true}\n", "utf8");

      const gate = await runReleaseGoNoGoGate({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot
      });

      expect(gate.overallOk).toBe(false);
      expect(gate.manifest.shaMatchesCatalog).toBe(false);
      expect(gate.manifest.issues.join("\n")).toMatch(/checksum mismatch/iu);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports published-only scope to skip local unpublished resorts", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-go-no-go-published-only-"));
    const publicRoot = join(root, "public");
    const publishedResort = "CA_Golden_Kicking_Horse";
    const unpublishedResort = "CA_Kananaskis_Nakiska_Ski_Area";

    try {
      const publishedV1 = join(root, "resorts", publishedResort, "v1");
      await mkdir(publishedV1, { recursive: true });
      await writeFile(
        join(publishedV1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(publishedV1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(publishedV1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(publishedV1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(publishedV1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(join(publishedV1, "basemap"), { recursive: true });
      await writeFile(join(publishedV1, "basemap", "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(publishedV1, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey: publishedResort,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      const unpublishedV1 = join(root, "resorts", unpublishedResort, "v1");
      await mkdir(unpublishedV1, { recursive: true });
      await writeFile(
        join(unpublishedV1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: false, validatedAt: null },
          readiness: { overall: "incomplete", issues: ["missing data"] }
        }),
        "utf8"
      );

      const gate = await runReleaseGoNoGoGate({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        publishedOnly: true
      });

      expect(gate.overallOk).toBe(true);
      expect(gate.summary.resortsChecked).toBe(1);
      expect(gate.resorts[0]?.resortKey).toBe(publishedResort);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports explicit --resort-key style scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-go-no-go-scoped-key-"));
    const publicRoot = join(root, "public");
    const targetResort = "CA_Golden_Kicking_Horse";

    try {
      const targetV1 = join(root, "resorts", targetResort, "v1");
      await mkdir(targetV1, { recursive: true });
      await writeFile(
        join(targetV1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(targetV1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(targetV1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(targetV1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(targetV1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(join(targetV1, "basemap"), { recursive: true });
      await writeFile(join(targetV1, "basemap", "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(targetV1, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey: targetResort,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      const gate = await runReleaseGoNoGoGate({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKeys: [targetResort]
      });

      expect(gate.overallOk).toBe(true);
      expect(gate.summary.resortsChecked).toBe(1);
      expect(gate.resorts[0]?.resortKey).toBe(targetResort);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("release-dry-run command helpers", () => {
  it("returns combined release gate and audit summary for published-only scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-dry-run-published-only-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";

    try {
      const v1 = join(root, "resorts", resortKey, "v1");
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(join(v1, "basemap"), { recursive: true });
      await writeFile(join(v1, "basemap", "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(v1, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      const result = await runReleaseDryRun({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        publishedOnly: true
      });

      expect(result.overallOk).toBe(true);
      expect(result.goNoGo.overallOk).toBe(true);
      expect(result.publishedAudit.overallOk).toBe(true);
      expect(result.summary.resortsChecked).toBe(1);
      expect(result.summary.releaseReadyResorts).toBe(1);
      expect(result.summary.publishedAuditFailures).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails dry-run when audit has scoped failures", async () => {
    const root = await mkdtemp(join(tmpdir(), "release-dry-run-audit-fail-"));
    const publicRoot = join(root, "public");
    const resortKey = "CA_Golden_Kicking_Horse";

    try {
      const v1 = join(root, "resorts", resortKey, "v1");
      await mkdir(v1, { recursive: true });
      await writeFile(
        join(v1, "status.json"),
        JSON.stringify({
          manualValidation: { validated: true, validatedAt: "2026-02-21T10:00:00.000Z" },
          readiness: { overall: "ready", issues: [] }
        }),
        "utf8"
      );
      await writeFile(
        join(v1, "resort.json"),
        JSON.stringify({
          schemaVersion: "2.0.0",
          resort: { query: { name: "Kicking Horse", country: "CA" } },
          layers: {
            boundary: { status: "complete", artifactPath: "boundary.geojson" },
            lifts: { status: "complete", artifactPath: "lifts.geojson" },
            runs: { status: "complete", artifactPath: "runs.geojson" }
          }
        }),
        "utf8"
      );
      await writeFile(join(v1, "boundary.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "runs.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await writeFile(join(v1, "lifts.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");
      await mkdir(join(v1, "basemap"), { recursive: true });
      await writeFile(join(v1, "basemap", "base.pmtiles"), new Uint8Array([1, 2, 3, 4]));
      await writeFile(
        join(v1, "basemap", "style.json"),
        JSON.stringify({ version: 8, sources: { basemap: { type: "vector" } }, layers: [{ id: "bg", type: "background" }] }),
        "utf8"
      );
      await publishLatestValidatedResortVersion({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKey,
        exportedAt: "2026-02-21T10:30:00.000Z"
      });

      await rm(join(publicRoot, "packs", resortKey, "style.json"), { force: true });
      const result = await runReleaseDryRun({
        resortsRoot: join(root, "resorts"),
        appPublicRoot: publicRoot,
        resortKeys: [resortKey]
      });

      expect(result.overallOk).toBe(false);
      expect(result.goNoGo.overallOk).toBe(false);
      expect(result.publishedAudit.overallOk).toBe(false);
      expect(result.summary.publishedAuditFailures).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
