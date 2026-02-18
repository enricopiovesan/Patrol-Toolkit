import type { FleetManifest } from "./fleet-run.js";
import type { RunExtractResortPipelineResult } from "./pipeline-run.js";

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

