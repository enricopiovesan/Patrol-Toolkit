import { describe, expect, it } from "vitest";
import {
  buildOfflineResortRows,
  clearPackCandidateSelections,
  togglePackCandidateSelection,
  type V4PackUpdateCandidate
} from "./settings-help-model";

describe("settings-help-model", () => {
  it("toggles pack candidate selection immutably", () => {
    const input: V4PackUpdateCandidate[] = [
      { resortId: "A", resortName: "A", version: "v1", selected: false },
      { resortId: "B", resortName: "B", version: "v2", selected: false }
    ];
    const result = togglePackCandidateSelection(input, "B", true);
    expect(result[0]?.selected).toBe(false);
    expect(result[1]?.selected).toBe(true);
    expect(input[1]?.selected).toBe(false);
  });

  it("clears all pack candidate selections", () => {
    const input: V4PackUpdateCandidate[] = [
      { resortId: "A", resortName: "A", version: "v1", selected: true },
      { resortId: "B", resortName: "B", version: "v2", selected: false }
    ];
    expect(clearPackCandidateSelections(input).every((candidate) => candidate.selected === false)).toBe(true);
  });

  it("builds offline resort rows with update badges", () => {
    const rows = buildOfflineResortRows({
      installedPacks: [
        { id: "B", name: "Fernie", sourceVersion: "v7", updatedAt: "2026-03-01T00:00:00Z" },
        { id: "A", name: "Kicking Horse", sourceVersion: "v4", updatedAt: "2026-03-01T00:00:00Z" }
      ],
      updateCandidates: [{ resortId: "B", resortName: "Fernie", version: "v8", selected: false }]
    });

    expect(rows.map((row) => row.resortId)).toEqual(["B", "A"]);
    expect(rows[0]).toMatchObject({ badge: "Update available", badgeTone: "warning" });
    expect(rows[1]).toMatchObject({ badge: "Offline ready", badgeTone: "success" });
  });
});
