import { describe, expect, it } from "vitest";
import { selectLatestEligibleVersions, type ResortCatalog } from "./catalog";

describe("resort catalog selection", () => {
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
        packUrl: "/packs/resort-a-v1.json"
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
        packUrl: "/packs/resort-b-v3.json"
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
});
