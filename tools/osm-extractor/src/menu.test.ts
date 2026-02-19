import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildResortKey,
  canonicalizeResortKeys,
  createNextVersionClone,
  formatKnownResortSummary,
  formatSearchCandidate,
  isBoundaryReadyForSync,
  listKnownResorts,
  parseCandidateSelection,
  persistResortVersion,
  rankSearchCandidates,
  toCanonicalResortKey
} from "./menu.js";

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
        JSON.stringify({
          manualValidation: {
            validated: true
          }
        }),
        "utf8"
      );

      const result = await listKnownResorts(root);
      expect(result).toEqual([
        {
          resortKey: "CA_Golden_Kicking_Horse",
          latestVersion: "v2",
          latestVersionNumber: 2,
          manuallyValidated: true
        }
      ]);
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

describe("menu output formatting", () => {
  it("formats known resort summary in compact labeled format", () => {
    const line = formatKnownResortSummary(1, {
      resortKey: "CA_Golden_Kicking_Horse",
      latestVersion: "v2",
      latestVersionNumber: 2,
      manuallyValidated: true
    });
    expect(line).toBe("1. CA_Golden_Kicking_Horse | latest=v2 | validated=yes");
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

      const statusRaw = await readFile(second.statusPath, "utf8");
      const status = JSON.parse(statusRaw) as { manualValidation: { validated: boolean } };
      expect(status.manualValidation.validated).toBe(false);

      const known = await listKnownResorts(root);
      expect(known).toEqual([
        {
          resortKey: "CA_Golden_Kicking_Horse",
          latestVersion: "v2",
          latestVersionNumber: 2,
          manuallyValidated: false
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
        };
      };
      expect(v2Status.version).toBe("v2");
      expect(v2Status.createdAt).toBe("2026-02-21T01:00:00.000Z");
      expect(v2Status.manualValidation).toEqual({
        validated: false,
        validatedAt: null,
        validatedBy: null,
        notes: null
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
