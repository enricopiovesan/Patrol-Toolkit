import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildResortKey,
  formatKnownResortSummary,
  formatSearchCandidate,
  listKnownResorts,
  parseCandidateSelection,
  persistResortVersion
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
      osmType: "node",
      osmId: 7248641928,
      displayName: "Kicking Horse, Golden, Canada",
      countryCode: "ca",
      country: "Canada",
      region: "British Columbia",
      center: [-116.96246, 51.29371],
      importance: 0.438,
      source: "nominatim"
    });

    expect(text).toMatch(/^2\. Kicking Horse, Golden, Canada/);
    expect(text).toMatch(/OSM: node\/7248641928/);
    expect(text).toMatch(/Country: CA/);
    expect(text).toMatch(/Region: British Columbia/);
    expect(text).toMatch(/Center: 51\.29371,-116\.96246/);
    expect(text).toMatch(/Importance: 0\.438/);
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
