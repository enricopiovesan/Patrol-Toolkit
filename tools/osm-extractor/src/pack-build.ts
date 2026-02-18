import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { assertNormalizedResortSource } from "./osm-normalized-validate.js";
import type {
  LngLat,
  NormalizedBoundary,
  NormalizedLift,
  NormalizedResortSource,
  NormalizedRun
} from "./osm-normalized-types.js";
import type { ResortPack } from "./pack-types.js";
import { validatePack } from "./pack-validate.js";
import { resolveGeneratedAt } from "./timestamp.js";

export type BuildPackOptions = {
  inputPath: string;
  outputPath: string;
  reportPath: string;
  timezone: string;
  pmtilesPath: string;
  stylePath: string;
  liftProximityMeters?: number;
  allowOutsideBoundary?: boolean;
  generatedAt?: string;
};

type BoundaryIssue = {
  entityType: "run" | "lift";
  entityId: string;
  message: string;
};

export type BuildPackReport = {
  schemaVersion: "0.3.0";
  generatedAt: string;
  sourceInput: string;
  resortId: string;
  counts: {
    runs: number;
    lifts: number;
    towers: number;
  };
  boundaryGate: {
    status: "passed" | "failed" | "skipped";
    issues: BoundaryIssue[];
  };
  warnings: string[];
};

export async function buildPackToFile(options: BuildPackOptions): Promise<{ pack: ResortPack; report: BuildPackReport }> {
  const raw = await readFile(options.inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  assertNormalizedResortSource(parsed);

  const { pack, report } = buildPackFromNormalized(parsed, {
    inputPath: basename(options.inputPath),
    timezone: options.timezone,
    pmtilesPath: options.pmtilesPath,
    stylePath: options.stylePath,
    liftProximityMeters: options.liftProximityMeters,
    allowOutsideBoundary: options.allowOutsideBoundary,
    generatedAt: options.generatedAt
  });

  await writeFile(options.outputPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { pack, report };
}

export function buildPackFromNormalized(
  source: NormalizedResortSource,
  options: {
    inputPath: string;
    timezone: string;
    pmtilesPath: string;
    stylePath: string;
    liftProximityMeters?: number;
    allowOutsideBoundary?: boolean;
    generatedAt?: string;
  }
): { pack: ResortPack; report: BuildPackReport } {
  const warnings = [...source.warnings];

  const lifts = source.lifts
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((lift) => ({
      id: lift.id,
      name: lift.name,
      towers: lift.towers.slice().sort((left, right) => left.number - right.number)
    }));

  const runs = source.runs
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((run) => toPackRun(run, warnings));

  const pack: ResortPack = {
    schemaVersion: "1.0.0",
    resort: {
      id: source.resort.id,
      name: source.resort.name,
      timezone: options.timezone
    },
    basemap: {
      pmtilesPath: options.pmtilesPath,
      stylePath: options.stylePath
    },
    thresholds: {
      liftProximityMeters: options.liftProximityMeters ?? 90
    },
    lifts,
    runs
  };

  const boundaryIssues = collectBoundaryIssues(source.boundary, source.runs, source.lifts);
  const gateStatus =
    source.boundary === null ? "skipped" : boundaryIssues.length === 0 ? "passed" : ("failed" as const);

  const report: BuildPackReport = {
    schemaVersion: "0.3.0",
    generatedAt: resolveGeneratedAt({
      override: options.generatedAt,
      sourceTimestamp: source.source.osmBaseTimestamp
    }),
    sourceInput: options.inputPath,
    resortId: source.resort.id,
    counts: {
      runs: pack.runs.length,
      lifts: pack.lifts.length,
      towers: pack.lifts.reduce((sum, lift) => sum + lift.towers.length, 0)
    },
    boundaryGate: {
      status: gateStatus,
      issues: boundaryIssues
    },
    warnings
  };

  if (gateStatus === "skipped") {
    report.warnings.push("Boundary gate skipped because normalized source has no boundary polygon.");
  }

  if (gateStatus === "failed" && !options.allowOutsideBoundary) {
    throw new Error(
      `Boundary gate failed with ${boundaryIssues.length} issue(s). Re-run with --allow-outside-boundary to override.`
    );
  }

  const validated = validatePack(pack);
  if (!validated.ok) {
    throw new Error(`Generated pack failed schema validation:\n${validated.errors.join("\n")}`);
  }

  return { pack: validated.value, report };
}

function toPackRun(run: NormalizedRun, warnings: string[]): ResortPack["runs"][number] {
  const mappedDifficulty = mapDifficulty(run.difficulty);
  if (mappedDifficulty.inferred) {
    warnings.push(
      `Run ${run.id} difficulty '${run.difficulty ?? "unknown"}' mapped to '${mappedDifficulty.value}'.`
    );
  }

  return {
    id: run.id,
    name: run.name,
    difficulty: mappedDifficulty.value,
    centerline: run.centerline,
    polygon: {
      type: "Polygon",
      coordinates: [buildCorridorPolygon(run.centerline.coordinates, corridorWidthMeters(mappedDifficulty.value))]
    }
  };
}

function corridorWidthMeters(difficulty: ResortPack["runs"][number]["difficulty"]): number {
  if (difficulty === "green") {
    return 28;
  }
  if (difficulty === "blue") {
    return 22;
  }
  if (difficulty === "black") {
    return 16;
  }
  return 12;
}

function mapDifficulty(value: string | null): { value: ResortPack["runs"][number]["difficulty"]; inferred: boolean } {
  const input = value?.trim().toLowerCase();

  if (input === "novice" || input === "easy" || input === "beginner" || input === "green") {
    return { value: "green", inferred: false };
  }
  if (input === "intermediate" || input === "blue" || input === "moderate") {
    return { value: "blue", inferred: false };
  }
  if (input === "advanced" || input === "expert" || input === "black") {
    return { value: "black", inferred: false };
  }
  if (input === "extreme" || input === "freeride" || input === "double_black" || input === "double-black") {
    return { value: "double-black", inferred: false };
  }

  return { value: "blue", inferred: true };
}

function collectBoundaryIssues(
  boundary: NormalizedBoundary | null,
  runs: NormalizedRun[],
  lifts: NormalizedLift[]
): BoundaryIssue[] {
  if (!boundary) {
    return [];
  }

  const issues: BoundaryIssue[] = [];
  const ring = boundary.polygon.coordinates[0] ?? [];

  for (const run of runs) {
    const outsidePoint = run.centerline.coordinates.find((point) => !pointInPolygon(point, ring));
    if (outsidePoint) {
      issues.push({
        entityType: "run",
        entityId: run.id,
        message: `Run point outside boundary at ${outsidePoint[0]},${outsidePoint[1]}.`
      });
    }
  }

  for (const lift of lifts) {
    const outsidePoint = lift.towers.map((tower) => tower.coordinates).find((point) => !pointInPolygon(point, ring));
    if (outsidePoint) {
      issues.push({
        entityType: "lift",
        entityId: lift.id,
        message: `Lift tower outside boundary at ${outsidePoint[0]},${outsidePoint[1]}.`
      });
    }
  }

  return issues.sort((left, right) => left.entityId.localeCompare(right.entityId));
}

function pointInPolygon(point: LngLat, ring: LngLat[]): boolean {
  if (ring.length < 4) {
    return false;
  }

  for (let i = 0; i < ring.length - 1; i += 1) {
    const start = ring[i];
    const end = ring[i + 1];
    if (!start || !end) {
      continue;
    }
    if (pointOnSegment(point, start, end)) {
      return true;
    }
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const pi = ring[i];
    const pj = ring[j];
    if (!pi || !pj) {
      continue;
    }

    const intersects =
      pi[1] > point[1] !== pj[1] > point[1] &&
      point[0] < ((pj[0] - pi[0]) * (point[1] - pi[1])) / (pj[1] - pi[1]) + pi[0];
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointOnSegment(point: LngLat, start: LngLat, end: LngLat): boolean {
  const epsilon = 1e-12;
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < -epsilon) {
    return false;
  }

  const squaredLength = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
  if (dot - squaredLength > epsilon) {
    return false;
  }

  return true;
}

function buildCorridorPolygon(centerline: LngLat[], widthMeters: number): LngLat[] {
  if (centerline.length < 2) {
    throw new Error("Cannot build corridor polygon with less than 2 centerline points.");
  }

  const halfWidth = widthMeters / 2;
  const leftSide: LngLat[] = [];
  const rightSide: LngLat[] = [];

  for (let index = 0; index < centerline.length; index += 1) {
    const current = centerline[index];
    const previous = centerline[index - 1] ?? current;
    const next = centerline[index + 1] ?? current;
    if (!current || !previous || !next) {
      continue;
    }

    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy);
    const safeLength = length > 0 ? length : 1;

    const normalX = -dy / safeLength;
    const normalY = dx / safeLength;
    const metersPerLonDegree = metersPerDegreeLongitude(current[1]);
    const offsetLon = (halfWidth * normalX) / metersPerLonDegree;
    const offsetLat = halfWidth * (normalY / 111320);

    leftSide.push([current[0] + offsetLon, current[1] + offsetLat]);
    rightSide.push([current[0] - offsetLon, current[1] - offsetLat]);
  }

  const polygon = [...leftSide, ...rightSide.reverse(), leftSide[0] as LngLat];
  if (polygon.length < 4) {
    throw new Error("Generated run polygon is invalid.");
  }
  return polygon;
}

function metersPerDegreeLongitude(latitude: number): number {
  return Math.max(111320 * Math.cos((latitude * Math.PI) / 180), 1);
}
