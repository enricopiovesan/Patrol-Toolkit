import type { BuildPackReport } from "./pack-build.js";
import type { FleetManifest } from "./fleet-run.js";
import type { NormalizedResortSource } from "./osm-normalized-types.js";
import type { ResortPack } from "./pack-types.js";
import type { RunExtractResortPipelineResult } from "./pipeline-run.js";

export type IngestOsmJsonResult = {
  ok: true;
  ingestion: {
    resortId: string;
    resortName: string;
    counts: {
      runs: number;
      lifts: number;
      warnings: number;
    };
    boundary: {
      present: boolean;
      source: "relation" | "way" | null;
      sourceId: number | null;
    };
  };
};

export type BuildPackJsonResult = {
  ok: true;
  build: {
    resortId: string;
    schemaVersion: string;
    counts: {
      runs: number;
      lifts: number;
      towers: number;
    };
    boundaryGate: "passed" | "failed" | "skipped";
    artifacts: {
      packPath: string;
      reportPath: string;
    };
  };
};

export type ExtractResortJsonResult = {
  ok: true;
  extraction: {
    resortId: string;
    generatedAt: string;
    counts: {
      runs: number;
      lifts: number;
    };
    boundaryGate: "passed" | "failed" | "skipped";
    artifacts: {
      packPath: string;
      reportPath: string;
      normalizedPath: string;
      provenancePath: string;
    };
    checksums: {
      packSha256: string;
      reportSha256: string;
      normalizedSha256: string;
    };
  };
};

export type ExtractFleetJsonResult = {
  ok: true;
  fleet: {
    generatedAt: string;
    totals: {
      resorts: number;
      success: number;
      failed: number;
    };
    artifacts: {
      manifestPath: string;
      provenancePath: string;
    };
  };
};

export function toIngestOsmJson(result: NormalizedResortSource): IngestOsmJsonResult {
  return {
    ok: true,
    ingestion: {
      resortId: result.resort.id,
      resortName: result.resort.name,
      counts: {
        runs: result.runs.length,
        lifts: result.lifts.length,
        warnings: result.warnings.length
      },
      boundary: {
        present: result.boundary !== null,
        source: result.boundary?.source ?? null,
        sourceId: result.boundary?.sourceId ?? null
      }
    }
  };
}

export function toBuildPackJson(args: {
  pack: ResortPack;
  report: BuildPackReport;
  packPath: string;
  reportPath: string;
}): BuildPackJsonResult {
  const towers = args.pack.lifts.reduce((count, lift) => count + lift.towers.length, 0);
  return {
    ok: true,
    build: {
      resortId: args.pack.resort.id,
      schemaVersion: args.pack.schemaVersion,
      counts: {
        runs: args.pack.runs.length,
        lifts: args.pack.lifts.length,
        towers
      },
      boundaryGate: args.report.boundaryGate.status,
      artifacts: {
        packPath: args.packPath,
        reportPath: args.reportPath
      }
    }
  };
}

export function toExtractResortJson(result: RunExtractResortPipelineResult): ExtractResortJsonResult {
  return {
    ok: true,
    extraction: {
      resortId: result.resortId,
      generatedAt: result.generatedAt,
      counts: {
        runs: result.runCount,
        lifts: result.liftCount
      },
      boundaryGate: result.boundaryGate,
      artifacts: {
        packPath: result.packPath,
        reportPath: result.reportPath,
        normalizedPath: result.normalizedPath,
        provenancePath: result.provenancePath
      },
      checksums: {
        packSha256: result.checksums.packSha256,
        reportSha256: result.checksums.reportSha256,
        normalizedSha256: result.checksums.normalizedSha256
      }
    }
  };
}

export function toExtractFleetJson(args: {
  manifest: FleetManifest;
  manifestPath: string;
  provenancePath: string;
}): ExtractFleetJsonResult {
  return {
    ok: true,
    fleet: {
      generatedAt: args.manifest.generatedAt,
      totals: {
        resorts: args.manifest.fleetSize,
        success: args.manifest.successCount,
        failed: args.manifest.failureCount
      },
      artifacts: {
        manifestPath: args.manifestPath,
        provenancePath: args.provenancePath
      }
    }
  };
}
