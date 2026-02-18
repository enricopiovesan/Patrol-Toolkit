import { describe, expect, it } from "vitest";
import { toExtractFleetJson, toExtractResortJson } from "./extraction-result.js";

describe("extraction result JSON formatters", () => {
  it("formats resort extraction result for machine-readable output", () => {
    const result = toExtractResortJson({
      resortId: "demo-resort",
      generatedAt: "2026-02-18T10:00:00.000Z",
      runCount: 7,
      liftCount: 4,
      boundaryGate: "passed",
      normalizedPath: "/tmp/normalized.json",
      packPath: "/tmp/pack.json",
      reportPath: "/tmp/report.json",
      provenancePath: "/tmp/provenance.json",
      checksums: {
        normalizedSha256: "a",
        packSha256: "b",
        reportSha256: "c"
      }
    });

    expect(result).toEqual({
      ok: true,
      extraction: {
        resortId: "demo-resort",
        generatedAt: "2026-02-18T10:00:00.000Z",
        counts: {
          runs: 7,
          lifts: 4
        },
        boundaryGate: "passed",
        artifacts: {
          packPath: "/tmp/pack.json",
          reportPath: "/tmp/report.json",
          normalizedPath: "/tmp/normalized.json",
          provenancePath: "/tmp/provenance.json"
        },
        checksums: {
          packSha256: "b",
          reportSha256: "c",
          normalizedSha256: "a"
        }
      }
    });
  });

  it("formats fleet extraction result for machine-readable output", () => {
    const result = toExtractFleetJson({
      manifestPath: "/tmp/fleet-manifest.json",
      provenancePath: "/tmp/fleet-provenance.json",
      manifest: {
        schemaVersion: "1.0.0",
        generatedAt: "2026-02-18T10:00:00.000Z",
        fleetSize: 3,
        successCount: 2,
        failureCount: 1,
        entries: []
      }
    });

    expect(result).toEqual({
      ok: true,
      fleet: {
        generatedAt: "2026-02-18T10:00:00.000Z",
        totals: {
          resorts: 3,
          success: 2,
          failed: 1
        },
        artifacts: {
          manifestPath: "/tmp/fleet-manifest.json",
          provenancePath: "/tmp/fleet-provenance.json"
        }
      }
    });
  });
});

