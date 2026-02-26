import Ajv, { type ErrorObject } from "ajv";
import { resortPackSchema } from "./schema";
import type { ResortPack, ResortPackValidationIssue, ResortPackValidationResult } from "./types";

const ajv = new Ajv({ allErrors: true, strict: true });
const validateResortPackSchema = ajv.compile(resortPackSchema);

export function validateResortPack(input: unknown): ResortPackValidationResult {
  const valid = validateResortPackSchema(input);

  const schemaErrors = mapSchemaErrors(validateResortPackSchema.errors);
  if (!valid) {
    return { ok: false, errors: sortIssues(schemaErrors) };
  }

  const semanticErrors = validateSemanticRules(input as ResortPack);
  if (semanticErrors.length > 0) {
    return { ok: false, errors: sortIssues(semanticErrors) };
  }

  return { ok: true, value: input as ResortPack };
}

function mapSchemaErrors(errors: ErrorObject[] | null | undefined): ResortPackValidationIssue[] {
  if (!errors) {
    return [{ code: "schema_violation", path: "#", message: "Unknown validation error." }];
  }

  return errors.map((error) => {
    const path = error.instancePath ? `#${error.instancePath}` : "#";
    return {
      code: "schema_violation",
      path,
      message: error.message ?? "Invalid value."
    };
  });
}

function validateSemanticRules(pack: ResortPack): ResortPackValidationIssue[] {
  const errors: ResortPackValidationIssue[] = [];
  const areaIds = new Set<string>();
  const terrainBandIds = new Set<string>();
  const contourIds = new Set<string>();
  const peakIds = new Set<string>();
  const runIds = new Set<string>();
  const liftIds = new Set<string>();

  if (!isValidIanaTimezone(pack.resort.timezone)) {
    errors.push({
      code: "invalid_timezone",
      path: "#/resort/timezone",
      message: `Invalid IANA timezone '${pack.resort.timezone}'.`
    });
  }

  if (!isOfflineRelativePath(pack.basemap.pmtilesPath) || !hasExpectedExtension(pack.basemap.pmtilesPath, ".pmtiles")) {
    errors.push({
      code: "offline_path_required",
      path: "#/basemap/pmtilesPath",
      message: "Basemap PMTiles path must be a local relative .pmtiles path."
    });
  }

  if (!isOfflineRelativePath(pack.basemap.stylePath) || !hasExpectedExtension(pack.basemap.stylePath, ".json")) {
    errors.push({
      code: "offline_path_required",
      path: "#/basemap/stylePath",
      message: "Basemap style path must be a local relative .json path."
    });
  }

  if (pack.boundary) {
    const boundaryRing = pack.boundary.coordinates[0] ?? [];
    if (!isClosedRing(boundaryRing)) {
      errors.push({
        code: "invalid_geometry",
        path: "#/boundary/coordinates/0",
        message: "Boundary polygon outer ring must be closed."
      });
    }
  }

  for (let index = 0; index < (pack.areas ?? []).length; index += 1) {
    const area = pack.areas?.[index];
    if (!area) {
      continue;
    }
    const areaPath = `#/areas/${index}`;

    if (areaIds.has(area.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${areaPath}/id`,
        message: `Duplicate area id '${area.id}'.`
      });
    } else {
      areaIds.add(area.id);
    }

    const outerRing = area.perimeter.coordinates[0] ?? [];
    if (!isClosedRing(outerRing)) {
      errors.push({
        code: "invalid_geometry",
        path: `${areaPath}/perimeter/coordinates/0`,
        message: "Area perimeter outer ring must be closed."
      });
    }
  }

  for (let index = 0; index < (pack.contours ?? []).length; index += 1) {
    const contour = pack.contours?.[index];
    if (!contour) {
      continue;
    }
    const contourPath = `#/contours/${index}`;

    if (contourIds.has(contour.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${contourPath}/id`,
        message: `Duplicate contour id '${contour.id}'.`
      });
    } else {
      contourIds.add(contour.id);
    }

    if (hasDuplicateConsecutivePoints(contour.line.coordinates)) {
      errors.push({
        code: "invalid_geometry",
        path: `${contourPath}/line/coordinates`,
        message: "Contour line has duplicate consecutive points."
      });
    }
  }

  for (let index = 0; index < (pack.terrainBands ?? []).length; index += 1) {
    const band = pack.terrainBands?.[index];
    if (!band) {
      continue;
    }
    const bandPath = `#/terrainBands/${index}`;

    if (terrainBandIds.has(band.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${bandPath}/id`,
        message: `Duplicate terrain band id '${band.id}'.`
      });
    } else {
      terrainBandIds.add(band.id);
    }

    const outerRing = band.polygon.coordinates[0] ?? [];
    if (!isClosedRing(outerRing)) {
      errors.push({
        code: "invalid_geometry",
        path: `${bandPath}/polygon/coordinates/0`,
        message: "Terrain band polygon outer ring must be closed."
      });
    }
  }

  for (let index = 0; index < (pack.peaks ?? []).length; index += 1) {
    const peak = pack.peaks?.[index];
    if (!peak) {
      continue;
    }
    const peakPath = `#/peaks/${index}`;

    if (peakIds.has(peak.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${peakPath}/id`,
        message: `Duplicate peak id '${peak.id}'.`
      });
    } else {
      peakIds.add(peak.id);
    }
  }

  for (let index = 0; index < pack.runs.length; index += 1) {
    const run = pack.runs[index];
    const runPath = `#/runs/${index}`;

    if (runIds.has(run.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${runPath}/id`,
        message: `Duplicate run id '${run.id}'.`
      });
    } else {
      runIds.add(run.id);
    }

    const outerRing = run.polygon.coordinates[0] ?? [];
    if (!isClosedRing(outerRing)) {
      errors.push({
        code: "invalid_geometry",
        path: `${runPath}/polygon/coordinates/0`,
        message: "Run polygon outer ring must be closed."
      });
    }

    if (hasDuplicateConsecutivePoints(run.centerline.coordinates)) {
      errors.push({
        code: "invalid_geometry",
        path: `${runPath}/centerline/coordinates`,
        message: "Run centerline has duplicate consecutive points."
      });
    }
  }

  for (let index = 0; index < pack.lifts.length; index += 1) {
    const lift = pack.lifts[index];
    const liftPath = `#/lifts/${index}`;

    if (liftIds.has(lift.id)) {
      errors.push({
        code: "duplicate_id",
        path: `${liftPath}/id`,
        message: `Duplicate lift id '${lift.id}'.`
      });
    } else {
      liftIds.add(lift.id);
    }

    const towerNumbers = new Set<number>();
    for (let towerIndex = 0; towerIndex < lift.towers.length; towerIndex += 1) {
      const tower = lift.towers[towerIndex];
      if (towerNumbers.has(tower.number)) {
        errors.push({
          code: "duplicate_tower_number",
          path: `${liftPath}/towers/${towerIndex}/number`,
          message: `Duplicate tower number ${tower.number} in lift '${lift.id}'.`
        });
      } else {
        towerNumbers.add(tower.number);
      }
    }
  }

  return errors;
}

function isClosedRing(ring: ResortPack["runs"][number]["polygon"]["coordinates"][number]): boolean {
  if (ring.length < 4) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) {
    return false;
  }

  return first[0] === last[0] && first[1] === last[1];
}

function hasDuplicateConsecutivePoints(
  coordinates: ResortPack["runs"][number]["centerline"]["coordinates"]
): boolean {
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (!previous || !current) {
      continue;
    }

    if (previous[0] === current[0] && previous[1] === current[1]) {
      return true;
    }
  }

  return false;
}

function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isOfflineRelativePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.startsWith("//")) {
    return false;
  }

  if (path.includes("://")) {
    return false;
  }

  return !path.split(/[\\/]/u).some((segment) => segment === "..");
}

function hasExpectedExtension(path: string, extension: ".pmtiles" | ".json"): boolean {
  return path.toLowerCase().endsWith(extension);
}

function sortIssues(issues: ResortPackValidationIssue[]): ResortPackValidationIssue[] {
  return [...issues].sort((left, right) => {
    const pathComparison = left.path.localeCompare(right.path);
    if (pathComparison !== 0) {
      return pathComparison;
    }

    return left.code.localeCompare(right.code);
  });
}
