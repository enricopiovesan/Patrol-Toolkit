import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  configPath: string
): Promise<{ manifestPath: string; manifest: FleetManifest }> {
  const config = await readExtractFleetConfig(configPath);
  const configDir = dirname(configPath);
  const manifestPath = resolve(configDir, config.output.manifestPath);
  await mkdir(dirname(manifestPath), { recursive: true });

  const continueOnError = config.options?.continueOnError ?? false;
  const entries: FleetManifestEntry[] = [];

  for (const resort of config.resorts) {
    const resortConfigPath = resolve(configDir, resort.configPath);
    try {
      const result = await runExtractResortPipeline(resortConfigPath);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      entries.push({
        id: resort.id,
        configPath: resort.configPath,
        status: "failed",
        error: message
      });
      if (!continueOnError) {
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

  if (failureCount > 0 && !continueOnError) {
    const firstFailure = entries.find((entry) => entry.status === "failed");
    throw new Error(
      `Fleet extraction failed for resort '${firstFailure?.id ?? "unknown"}'. See manifest at ${manifestPath}.`
    );
  }

  return { manifestPath, manifest };
}

