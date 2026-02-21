import { afterEach, describe, expect, it, vi } from "vitest";
import { assertReleaseManifest, loadReleaseManifest } from "./release-manifest";

describe("release manifest validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid manifest payload", () => {
    const manifest = assertReleaseManifest({
      schemaVersion: "1.0.0",
      release: {
        channel: "stable",
        appVersion: "1.0.0",
        createdAt: "2026-02-21T00:00:00.000Z"
      },
      artifacts: [
        {
          kind: "app",
          url: "/releases/v1.0.0/app.zip",
          sha256: "a".repeat(64),
          bytes: 12345
        },
        {
          kind: "pack",
          resortId: "CA_Golden_Kicking_Horse",
          version: "v1",
          url: "/packs/CA_Golden_Kicking_Horse.latest.validated.json",
          sha256: "b".repeat(64),
          bytes: 4567
        }
      ]
    });

    expect(manifest.release.appVersion).toBe("1.0.0");
    expect(manifest.artifacts).toHaveLength(2);
  });

  it("rejects invalid artifact checksums", () => {
    expect(() =>
      assertReleaseManifest({
        schemaVersion: "1.0.0",
        release: {
          channel: "stable",
          appVersion: "1.0.0",
          createdAt: "2026-02-21T00:00:00.000Z"
        },
        artifacts: [
          {
            kind: "app",
            url: "/releases/v1.0.0/app.zip",
            sha256: "bad",
            bytes: 12345
          }
        ]
      })
    ).toThrow(/sha256/iu);
  });

  it("rejects invalid semver in release metadata", () => {
    expect(() =>
      assertReleaseManifest({
        schemaVersion: "1.0.0",
        release: {
          channel: "stable",
          appVersion: "v1",
          createdAt: "2026-02-21T00:00:00.000Z"
        },
        artifacts: [
          {
            kind: "catalog",
            url: "/resort-packs/index.json",
            sha256: "a".repeat(64),
            bytes: 111
          }
        ]
      })
    ).toThrow(/appVersion/iu);
  });

  it("loads and validates manifest over fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: "1.0.0",
          release: {
            channel: "stable",
            appVersion: "1.0.0",
            createdAt: "2026-02-21T00:00:00.000Z"
          },
          artifacts: [
            {
              kind: "catalog",
              url: "/resort-packs/index.json",
              sha256: "c".repeat(64),
              bytes: 222
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await loadReleaseManifest("/releases/stable-manifest.json");
    expect(result.artifacts[0]?.kind).toBe("catalog");
  });

  it("throws on fetch failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(loadReleaseManifest("/releases/stable-manifest.json")).rejects.toThrow(/Unable to load/iu);
  });
});
