import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { type AuditLogger, noopAuditLogger } from "./audit-log.js";
import { buildPackToFile } from "./pack-build.js";
import { ingestOsmToFile } from "./osm-ingest.js";
import { readExtractResortConfig } from "./pipeline-config.js";
import { readPack, validatePack } from "./pack-validate.js";
import { sha256File, writeJsonFile } from "./provenance.js";
import { resolveGeneratedAt } from "./timestamp.js";

export type RunExtractResortPipelineResult = {
  normalizedPath: string;
  packPath: string;
  reportPath: string;
  provenancePath: string;
  resortId: string;
  runCount: number;
  liftCount: number;
  boundaryGate: "passed" | "failed" | "skipped";
  checksums: {
    normalizedSha256: string;
    packSha256: string;
    reportSha256: string;
  };
  generatedAt: string;
};

export async function runExtractResortPipeline(
  configPath: string,
  options?: {
    logger?: AuditLogger;
    fleetResortId?: string;
    generatedAt?: string;
  }
): Promise<RunExtractResortPipelineResult> {
  const logger = options?.logger ?? noopAuditLogger;
  const fleetResortId = options?.fleetResortId ?? null;

  await logger.write("info", "resort_pipeline_started", {
    configPath,
    fleetResortId
  });

  try {
    const config = await readExtractResortConfig(configPath);
    const configDir = dirname(configPath);

    const outputDirectory = resolve(configDir, config.output.directory);
    await mkdir(outputDirectory, { recursive: true });

    const normalizedFile = config.output.normalizedFile ?? "normalized-source.json";
    const packFile = config.output.packFile ?? "pack.json";
    const reportFile = config.output.reportFile ?? "extraction-report.json";
    const provenanceFile = config.output.provenanceFile ?? "provenance.json";

    const normalizedPath = join(outputDirectory, normalizedFile);
    const packPath = join(outputDirectory, packFile);
    const reportPath = join(outputDirectory, reportFile);
    const provenancePath = join(outputDirectory, provenanceFile);

    const osmInputPath = resolve(configDir, config.source.osmInputPath);
    await logger.write("info", "resort_ingest_started", {
      resortId: config.resort.id ?? null,
      configPath,
      osmInputPath
    });
    const normalized = await ingestOsmToFile({
      inputPath: osmInputPath,
      outputPath: normalizedPath,
      resortId: config.resort.id,
      resortName: config.resort.name,
      boundaryRelationId: config.resort.boundaryRelationId,
      bbox: config.source.area?.bbox
    });
    await logger.write("info", "resort_ingest_completed", {
      resortId: normalized.resort.id,
      runs: normalized.runs.length,
      lifts: normalized.lifts.length,
      warnings: normalized.warnings.length,
      normalizedPath
    });

    await logger.write("info", "resort_pack_build_started", {
      resortId: normalized.resort.id,
      normalizedPath
    });
    const buildResult = await buildPackToFile({
      inputPath: normalizedPath,
      outputPath: packPath,
      reportPath,
      timezone: config.resort.timezone,
      pmtilesPath: config.basemap.pmtilesPath,
      stylePath: config.basemap.stylePath,
      liftProximityMeters: config.thresholds?.liftProximityMeters,
      allowOutsideBoundary: config.qa?.allowOutsideBoundary,
      generatedAt: options?.generatedAt ?? config.determinism?.generatedAt
    });
    await logger.write("info", "resort_pack_build_completed", {
      resortId: normalized.resort.id,
      packPath,
      reportPath,
      boundaryGate: buildResult.report.boundaryGate.status
    });

    const loadedPack = await readPack(packPath);
    const validation = validatePack(loadedPack);
    if (!validation.ok) {
      await logger.write("error", "resort_pipeline_validation_failed", {
        resortId: normalized.resort.id,
        configPath,
        errors: validation.errors
      });
      throw new Error(`Pipeline generated invalid pack:\n${validation.errors.join("\n")}`);
    }

    const generatedAt = resolveGeneratedAt({
      override: options?.generatedAt ?? config.determinism?.generatedAt,
      sourceTimestamp: normalized.source.osmBaseTimestamp
    });

    const result = {
      normalizedPath,
      packPath,
      reportPath,
      provenancePath,
      resortId: normalized.resort.id,
      runCount: buildResult.pack.runs.length,
      liftCount: buildResult.pack.lifts.length,
      boundaryGate: buildResult.report.boundaryGate.status,
      checksums: {
        normalizedSha256: await sha256File(normalizedPath),
        packSha256: await sha256File(packPath),
        reportSha256: await sha256File(reportPath)
      },
      generatedAt
    };

    await writeJsonFile(provenancePath, {
      schemaVersion: "1.2.0",
      generatedAt: result.generatedAt,
      configPath,
      resort: {
        id: result.resortId,
        name: buildResult.pack.resort.name,
        timezone: buildResult.pack.resort.timezone
      },
      source: {
        format: normalized.source.format,
        inputPath: normalized.source.inputPath,
        osmBaseTimestamp: normalized.source.osmBaseTimestamp,
        sourceSha256: normalized.source.sha256
      },
      artifacts: {
        normalizedPath,
        normalizedSha256: result.checksums.normalizedSha256,
        packPath,
        packSha256: result.checksums.packSha256,
        reportPath,
        reportSha256: result.checksums.reportSha256
      }
    });
    await logger.write("info", "resort_provenance_written", {
      resortId: result.resortId,
      provenancePath
    });

    await logger.write("info", "resort_pipeline_completed", {
      resortId: result.resortId,
      configPath,
      runCount: result.runCount,
      liftCount: result.liftCount,
      boundaryGate: result.boundaryGate,
      provenancePath: result.provenancePath
    });

    return result;
  } catch (error: unknown) {
    await logger.write("error", "resort_pipeline_failed", {
      configPath,
      fleetResortId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
