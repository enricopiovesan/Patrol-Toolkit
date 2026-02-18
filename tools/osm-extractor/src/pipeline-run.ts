import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildPackToFile } from "./pack-build.js";
import { ingestOsmToFile } from "./osm-ingest.js";
import { readExtractResortConfig } from "./pipeline-config.js";
import { readPack, validatePack } from "./pack-validate.js";

export type RunExtractResortPipelineResult = {
  normalizedPath: string;
  packPath: string;
  reportPath: string;
  resortId: string;
  runCount: number;
  liftCount: number;
  boundaryGate: "passed" | "failed" | "skipped";
};

export async function runExtractResortPipeline(configPath: string): Promise<RunExtractResortPipelineResult> {
  const config = await readExtractResortConfig(configPath);
  const configDir = dirname(configPath);

  const outputDirectory = resolve(configDir, config.output.directory);
  await mkdir(outputDirectory, { recursive: true });

  const normalizedFile = config.output.normalizedFile ?? "normalized-source.json";
  const packFile = config.output.packFile ?? "pack.json";
  const reportFile = config.output.reportFile ?? "extraction-report.json";

  const normalizedPath = join(outputDirectory, normalizedFile);
  const packPath = join(outputDirectory, packFile);
  const reportPath = join(outputDirectory, reportFile);

  const osmInputPath = resolve(configDir, config.source.osmInputPath);
  const normalized = await ingestOsmToFile({
    inputPath: osmInputPath,
    outputPath: normalizedPath,
    resortId: config.resort.id,
    resortName: config.resort.name,
    boundaryRelationId: config.resort.boundaryRelationId
  });

  const buildResult = await buildPackToFile({
    inputPath: normalizedPath,
    outputPath: packPath,
    reportPath,
    timezone: config.resort.timezone,
    pmtilesPath: config.basemap.pmtilesPath,
    stylePath: config.basemap.stylePath,
    liftProximityMeters: config.thresholds?.liftProximityMeters,
    allowOutsideBoundary: config.qa?.allowOutsideBoundary
  });

  const loadedPack = await readPack(packPath);
  const validation = validatePack(loadedPack);
  if (!validation.ok) {
    throw new Error(`Pipeline generated invalid pack:\n${validation.errors.join("\n")}`);
  }

  return {
    normalizedPath,
    packPath,
    reportPath,
    resortId: normalized.resort.id,
    runCount: buildResult.pack.runs.length,
    liftCount: buildResult.pack.lifts.length,
    boundaryGate: buildResult.report.boundaryGate.status
  };
}

