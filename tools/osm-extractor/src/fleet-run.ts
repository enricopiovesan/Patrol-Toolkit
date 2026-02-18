import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type AuditLogger, noopAuditLogger } from "./audit-log.js";
import { readExtractFleetConfig } from "./fleet-config.js";
import { runExtractResortPipeline } from "./pipeline-run.js";

export type FleetManifestEntry =
  | {
      id: string;
      configPath: string;
      status: "success";
      packPath: string;
      reportPath: string;
      normalizedPath: string;
      runCount: number;
      liftCount: number;
      boundaryGate: "passed" | "failed" | "skipped";
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
): Promise<{ manifestPath: string; manifest: FleetManifest }> {
  const logger = options?.logger ?? noopAuditLogger;

  await logger.write("info", "fleet_pipeline_started", {
    configPath
  });

  const config = await readExtractFleetConfig(configPath);
  const configDir = dirname(configPath);
  const manifestPath = resolve(configDir, config.output.manifestPath);
  await mkdir(dirname(manifestPath), { recursive: true });

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
        runCount: result.runCount,
        liftCount: result.liftCount,
        boundaryGate: result.boundaryGate
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
  await logger.write("info", "fleet_manifest_written", {
    manifestPath,
    fleetSize: manifest.fleetSize,
    successCount: manifest.successCount,
    failureCount: manifest.failureCount
  });

  if (failureCount > 0 && !continueOnError) {
    const firstFailure = entries.find((entry) => entry.status === "failed");
    throw new Error(
      `Fleet extraction failed for resort '${firstFailure?.id ?? "unknown"}'. See manifest at ${manifestPath}.`
    );
  }

  await logger.write("info", "fleet_pipeline_completed", {
    manifestPath,
    successCount: manifest.successCount,
    failureCount: manifest.failureCount
  });

  return { manifestPath, manifest };
}
