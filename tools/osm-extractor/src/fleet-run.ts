import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type AuditLogger, noopAuditLogger } from "./audit-log.js";
import { readExtractFleetConfig } from "./fleet-config.js";
import { runExtractResortPipeline } from "./pipeline-run.js";
import { sha256File, writeJsonFile } from "./provenance.js";

export type FleetManifestEntry =
  | {
      id: string;
      configPath: string;
      status: "success";
      packPath: string;
      reportPath: string;
      normalizedPath: string;
      provenancePath: string;
      runCount: number;
      liftCount: number;
      boundaryGate: "passed" | "failed" | "skipped";
      checksums: {
        normalizedSha256: string;
        packSha256: string;
        reportSha256: string;
      };
    }
  | {
      id: string;
      configPath: string;
      status: "failed";
      error: string;
    };

export type FleetManifest = {
  schemaVersion: "1.0.0";
  generatedAt: string;
  fleetSize: number;
  successCount: number;
  failureCount: number;
  entries: FleetManifestEntry[];
};

export async function runExtractFleetPipeline(
  configPath: string,
  options?: {
    logger?: AuditLogger;
  }
): Promise<{ manifestPath: string; provenancePath: string; manifest: FleetManifest }> {
  const logger = options?.logger ?? noopAuditLogger;

  await logger.write("info", "fleet_pipeline_started", {
    configPath
  });

  const config = await readExtractFleetConfig(configPath);
  const configDir = dirname(configPath);
  const manifestPath = resolve(configDir, config.output.manifestPath);
  const provenancePath = resolve(configDir, config.output.provenancePath ?? "./fleet-provenance.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await mkdir(dirname(provenancePath), { recursive: true });

  const continueOnError = config.options?.continueOnError ?? false;
  const entries: FleetManifestEntry[] = [];

  for (const resort of config.resorts) {
    const resortConfigPath = resolve(configDir, resort.configPath);
    await logger.write("info", "fleet_resort_started", {
      fleetResortId: resort.id,
      configPath: resort.configPath
    });
    try {
      const result = await runExtractResortPipeline(resortConfigPath, {
        logger,
        fleetResortId: resort.id
      });
      entries.push({
        id: resort.id,
        configPath: resort.configPath,
        status: "success",
        packPath: result.packPath,
        reportPath: result.reportPath,
        normalizedPath: result.normalizedPath,
        provenancePath: result.provenancePath,
        runCount: result.runCount,
        liftCount: result.liftCount,
        boundaryGate: result.boundaryGate,
        checksums: result.checksums
      });
      await logger.write("info", "fleet_resort_completed", {
        fleetResortId: resort.id,
        runCount: result.runCount,
        liftCount: result.liftCount,
        boundaryGate: result.boundaryGate
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      entries.push({
        id: resort.id,
        configPath: resort.configPath,
        status: "failed",
        error: message
      });
      await logger.write("error", "fleet_resort_failed", {
        fleetResortId: resort.id,
        error: message
      });
      if (!continueOnError) {
        await logger.write("error", "fleet_pipeline_stopped_on_failure", {
          fleetResortId: resort.id
        });
        break;
      }
    }
  }

  const successCount = entries.filter((entry) => entry.status === "success").length;
  const failureCount = entries.length - successCount;
  const manifest: FleetManifest = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    fleetSize: config.resorts.length,
    successCount,
    failureCount,
    entries
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const manifestSha256 = await sha256File(manifestPath);
  await writeJsonFile(provenancePath, {
    schemaVersion: "1.2.0",
    generatedAt: new Date().toISOString(),
    configPath,
    manifest: {
      path: manifestPath,
      sha256: manifestSha256
    },
    resorts: entries.map((entry) =>
      entry.status === "success"
        ? {
            id: entry.id,
            status: entry.status,
            configPath: entry.configPath,
            provenancePath: entry.provenancePath,
            artifacts: {
              packPath: entry.packPath,
              packSha256: entry.checksums.packSha256,
              reportPath: entry.reportPath,
              reportSha256: entry.checksums.reportSha256,
              normalizedPath: entry.normalizedPath,
              normalizedSha256: entry.checksums.normalizedSha256
            }
          }
        : {
            id: entry.id,
            status: entry.status,
            configPath: entry.configPath,
            error: entry.error
          }
    )
  });
  await logger.write("info", "fleet_manifest_written", {
    manifestPath,
    fleetSize: manifest.fleetSize,
    successCount: manifest.successCount,
    failureCount: manifest.failureCount
  });
  await logger.write("info", "fleet_provenance_written", {
    provenancePath
  });

  if (failureCount > 0 && !continueOnError) {
    const firstFailure = entries.find((entry) => entry.status === "failed");
    throw new Error(
      `Fleet extraction failed for resort '${firstFailure?.id ?? "unknown"}'. See manifest at ${manifestPath}.`
    );
  }

  await logger.write("info", "fleet_pipeline_completed", {
    manifestPath,
    provenancePath,
    successCount: manifest.successCount,
    failureCount: manifest.failureCount
  });

  return { manifestPath, provenancePath, manifest };
}
