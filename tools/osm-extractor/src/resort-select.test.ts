import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectCandidateByIndex, selectResortToWorkspace } from "./resort-select.js";
import type { ResortSearchCandidate } from "./resort-search.js";

const candidates: ResortSearchCandidate[] = [
  {
    osmType: "relation",
    osmId: 100,
    displayName: "Resort A, Canada",
    countryCode: "ca",
    country: "Canada",
    region: "British Columbia",
    center: [-116.9, 51.3],
    importance: 0.8,
    source: "nominatim"
  },
  {
    osmType: "relation",
    osmId: 200,
    displayName: "Resort B, Canada",
    countryCode: "ca",
    country: "Canada",
    region: "British Columbia",
    center: [-116.8, 51.2],
    importance: 0.6,
    source: "nominatim"
  }
];

describe("resort select", () => {
  it("selects a candidate by 1-based index", () => {
    const selected = selectCandidateByIndex(candidates, 2);
    expect(selected.osmId).toBe(200);
  });

  it("rejects out-of-range index", () => {
    expect(() => selectCandidateByIndex(candidates, 3)).toThrow(/out of range/);
  });

  it("writes selected resort into workspace state", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "resort-select-"));
    const workspacePath = join(workspace, "state", "resort.json");

    try {
      const result = await selectResortToWorkspace(
        {
          workspacePath,
          name: "Kicking Horse",
          country: "CA",
          index: 1,
          limit: 5
        },
        {
          searchFn: async () => ({
            query: { name: "Kicking Horse", country: "CA", limit: 5 },
            candidates
          }),
          nowIso: () => "2026-02-18T10:00:00.000Z"
        }
      );

      expect(result.selected.osmId).toBe(100);
      const raw = await readFile(workspacePath, "utf8");
      const parsed = JSON.parse(raw) as {
        resort: { selection: { osmId: number } };
        layers: { boundary: { status: string } };
      };
      expect(parsed.resort.selection.osmId).toBe(100);
      expect(parsed.layers.boundary.status).toBe("pending");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
