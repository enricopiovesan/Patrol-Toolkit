import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import type {
  LngLat,
  NormalizedBoundary,
  NormalizedLift,
  NormalizedResortSource,
  NormalizedRun
} from "./osm-normalized-types.js";
import { assertNormalizedResortSource } from "./osm-normalized-validate.js";
import type { OSMDocument, OSMElement, OSMNode, OSMRelation, OSMWay } from "./osm-types.js";

export type IngestOsmOptions = {
  inputPath: string;
  outputPath: string;
  resortId?: string;
  resortName?: string;
  boundaryRelationId?: number;
};

const SUPPORTED_AERIALWAYS = new Set([
  "chair_lift",
  "drag_lift",
  "gondola",
  "mixed_lift",
  "t-bar",
  "j-bar",
  "platter",
  "rope_tow",
  "magic_carpet",
  "cable_car",
  "funicular"
]);

const BOUNDARY_TAG_VALUES = new Set(["winter_sports", "ski_resort"]);

export async function ingestOsmToFile(options: IngestOsmOptions): Promise<NormalizedResortSource> {
  const raw = await readFile(options.inputPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const document = parseOsmDocument(parsed);
  const sourceHash = sha256(raw);
  const normalized = normalizeOsmDocument(document, {
    sourceHash,
    inputPath: basename(options.inputPath),
    resortId: options.resortId,
    resortName: options.resortName,
    boundaryRelationId: options.boundaryRelationId
  });
  assertNormalizedResortSource(normalized);

  await writeFile(options.outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function normalizeOsmDocument(
  document: OSMDocument,
  options: {
    sourceHash: string;
    inputPath?: string;
    resortId?: string;
    resortName?: string;
    boundaryRelationId?: number;
  }
): NormalizedResortSource {
  const warnings: string[] = [];
  const nodesById = new Map<number, OSMNode>();
  const waysById = new Map<number, OSMWay>();
  const relations: OSMRelation[] = [];

  for (const element of document.elements) {
    if (element.type === "node") {
      nodesById.set(element.id, element);
    } else if (element.type === "way") {
      waysById.set(element.id, element);
    } else {
      relations.push(element);
    }
  }

  const runs = Array.from(waysById.values())
    .filter(isRunWay)
    .map((way) => toRun(way, nodesById, warnings))
    .filter((run): run is NormalizedRun => run !== null)
    .sort((left, right) => left.sourceWayId - right.sourceWayId);

  const lifts = Array.from(waysById.values())
    .filter(isLiftWay)
    .map((way) => toLift(way, nodesById, warnings))
    .filter((lift): lift is NormalizedLift => lift !== null)
    .sort((left, right) => left.sourceWayId - right.sourceWayId);

  const boundary = findBoundary({
    waysById,
    relations,
    nodesById,
    preferredRelationId: options.boundaryRelationId
  });

  if (!boundary) {
    warnings.push("No resort boundary found in OSM source.");
  }

  const resortName = options.resortName ?? inferResortName(boundary, waysById, relations) ?? "Unknown Resort";
  const resortId = options.resortId ?? slugify(resortName);

  return {
    schemaVersion: "0.2.0",
    resort: {
      id: resortId,
      name: resortName
    },
    source: {
      format: "osm-overpass-json",
      sha256: options.sourceHash,
      inputPath: options.inputPath ?? null,
      osmBaseTimestamp: document.osm3s?.timestamp_osm_base ?? null
    },
    boundary,
    lifts,
    runs,
    warnings
  };
}

export function parseOsmDocument(value: unknown): OSMDocument {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid OSM input: expected object root.");
  }

  const candidate = value as Partial<OSMDocument>;
  if (!Array.isArray(candidate.elements)) {
    throw new Error("Invalid OSM input: missing elements array.");
  }

  const elements: OSMElement[] = candidate.elements.map((element, index) => {
    if (!element || typeof element !== "object") {
      throw new Error(`Invalid OSM element at index ${index}.`);
    }

    const e = element as Record<string, unknown>;
    if (e.type === "node") {
      if (typeof e.id !== "number" || typeof e.lat !== "number" || typeof e.lon !== "number") {
        throw new Error(`Invalid OSM node at index ${index}.`);
      }
      return {
        type: "node",
        id: e.id,
        lat: e.lat,
        lon: e.lon,
        tags: readTags(e.tags)
      };
    }

    if (e.type === "way") {
      if (typeof e.id !== "number" || !Array.isArray(e.nodes) || e.nodes.some((node) => typeof node !== "number")) {
        throw new Error(`Invalid OSM way at index ${index}.`);
      }
      return {
        type: "way",
        id: e.id,
        nodes: e.nodes as number[],
        tags: readTags(e.tags)
      };
    }

    if (e.type === "relation") {
      if (typeof e.id !== "number" || !Array.isArray(e.members)) {
        throw new Error(`Invalid OSM relation at index ${index}.`);
      }

      const members: OSMRelation["members"] = e.members.map((member, memberIndex) => {
        if (!member || typeof member !== "object") {
          throw new Error(`Invalid OSM relation member at ${index}/${memberIndex}.`);
        }

        const m = member as Record<string, unknown>;
        if (typeof m.ref !== "number" || typeof m.role !== "string") {
          throw new Error(`Invalid OSM relation member at ${index}/${memberIndex}.`);
        }
        const memberType = m.type;
        if (memberType !== "node" && memberType !== "way" && memberType !== "relation") {
          throw new Error(`Invalid OSM relation member at ${index}/${memberIndex}.`);
        }
        const typedMember: OSMRelation["members"][number] = {
          type: memberType,
          ref: m.ref,
          role: m.role
        };
        return typedMember;
      });

      return {
        type: "relation",
        id: e.id,
        members,
        tags: readTags(e.tags)
      };
    }

    throw new Error(`Unsupported OSM element type at index ${index}.`);
  });

  return {
    version: typeof candidate.version === "number" ? candidate.version : undefined,
    generator: typeof candidate.generator === "string" ? candidate.generator : undefined,
    osm3s:
      candidate.osm3s && typeof candidate.osm3s === "object"
        ? {
            timestamp_osm_base:
              typeof candidate.osm3s.timestamp_osm_base === "string" ? candidate.osm3s.timestamp_osm_base : undefined
          }
        : undefined,
    elements
  };
}

function isRunWay(way: OSMWay): boolean {
  return way.tags?.["piste:type"] === "downhill";
}

function isLiftWay(way: OSMWay): boolean {
  const aerialway = way.tags?.aerialway;
  return Boolean(aerialway && SUPPORTED_AERIALWAYS.has(aerialway));
}

function toRun(way: OSMWay, nodesById: Map<number, OSMNode>, warnings: string[]): NormalizedRun | null {
  const coordinates = toCoordinates(way.nodes, nodesById);
  if (coordinates.length < 2) {
    warnings.push(`Skipped run way ${way.id}: requires at least 2 mapped nodes.`);
    return null;
  }

  return {
    id: `run-way-${way.id}`,
    name: way.tags?.name?.trim() || `Run ${way.id}`,
    difficulty: way.tags?.["piste:difficulty"] ?? null,
    sourceWayId: way.id,
    centerline: {
      type: "LineString",
      coordinates
    }
  };
}

function toLift(way: OSMWay, nodesById: Map<number, OSMNode>, warnings: string[]): NormalizedLift | null {
  const coordinates = toCoordinates(way.nodes, nodesById);
  if (coordinates.length < 2) {
    warnings.push(`Skipped lift way ${way.id}: requires at least 2 mapped nodes.`);
    return null;
  }

  const towers = coordinates.map((towerCoordinates, index) => ({
    number: index + 1,
    coordinates: towerCoordinates
  }));

  return {
    id: `lift-way-${way.id}`,
    name: way.tags?.name?.trim() || `Lift ${way.id}`,
    kind: way.tags?.aerialway ?? "unknown",
    sourceWayId: way.id,
    line: {
      type: "LineString",
      coordinates
    },
    towers
  };
}

function toCoordinates(nodeIds: number[], nodesById: Map<number, OSMNode>): LngLat[] {
  const coordinates: LngLat[] = [];
  for (const nodeId of nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    coordinates.push([node.lon, node.lat]);
  }
  return coordinates;
}

function findBoundary(args: {
  waysById: Map<number, OSMWay>;
  relations: OSMRelation[];
  nodesById: Map<number, OSMNode>;
  preferredRelationId?: number;
}): NormalizedBoundary | null {
  const relationCandidates =
    args.preferredRelationId !== undefined
      ? args.relations.filter((relation) => relation.id === args.preferredRelationId)
      : args.relations.filter(isBoundaryRelation);

  const relationBoundary = selectRelationBoundary(relationCandidates, args.waysById, args.nodesById);
  if (relationBoundary) {
    return relationBoundary;
  }

  const wayCandidates = Array.from(args.waysById.values()).filter(isBoundaryWay);
  return selectWayBoundary(wayCandidates, args.nodesById);
}

function selectRelationBoundary(
  relations: OSMRelation[],
  waysById: Map<number, OSMWay>,
  nodesById: Map<number, OSMNode>
): NormalizedBoundary | null {
  let bestBoundary: NormalizedBoundary | null = null;
  let bestArea = -1;

  for (const relation of relations) {
    const outerWays = relation.members
      .filter((member) => member.type === "way" && member.role === "outer")
      .map((member) => waysById.get(member.ref))
      .filter((way): way is OSMWay => way !== undefined);

    const boundary = selectWayBoundary(outerWays, nodesById, {
      source: "relation",
      sourceId: relation.id
    });

    if (!boundary) {
      continue;
    }

    const area = polygonArea(boundary.polygon.coordinates[0]);
    if (area > bestArea) {
      bestBoundary = boundary;
      bestArea = area;
    }
  }

  return bestBoundary;
}

function selectWayBoundary(
  ways: OSMWay[],
  nodesById: Map<number, OSMNode>,
  overrideSource?: { source: "relation"; sourceId: number }
): NormalizedBoundary | null {
  let bestBoundary: NormalizedBoundary | null = null;
  let bestArea = -1;

  for (const way of ways) {
    const ring = toCoordinates(way.nodes, nodesById);
    if (!isClosedRing(ring) || ring.length < 4) {
      continue;
    }

    const area = polygonArea(ring);
    if (area <= bestArea) {
      continue;
    }

    bestBoundary = {
      source: overrideSource?.source ?? "way",
      sourceId: overrideSource?.sourceId ?? way.id,
      polygon: {
        type: "Polygon",
        coordinates: [ring]
      }
    };
    bestArea = area;
  }

  return bestBoundary;
}

function isBoundaryRelation(relation: OSMRelation): boolean {
  const tags = relation.tags ?? {};
  const type = tags.type;
  if (type !== "multipolygon" && type !== "boundary") {
    return false;
  }
  return hasBoundaryTag(tags);
}

function isBoundaryWay(way: OSMWay): boolean {
  if (!way.tags) {
    return false;
  }
  return hasBoundaryTag(way.tags);
}

function hasBoundaryTag(tags: Record<string, string>): boolean {
  const leisure = tags.leisure?.toLowerCase();
  const landuse = tags.landuse?.toLowerCase();
  const boundary = tags.boundary?.toLowerCase();
  return (
    (leisure !== undefined && BOUNDARY_TAG_VALUES.has(leisure)) ||
    (landuse !== undefined && BOUNDARY_TAG_VALUES.has(landuse)) ||
    boundary === "ski_resort"
  );
}

function inferResortName(
  boundary: NormalizedBoundary | null,
  waysById: Map<number, OSMWay>,
  relations: OSMRelation[]
): string | null {
  if (boundary?.source === "way") {
    return waysById.get(boundary.sourceId)?.tags?.name ?? null;
  }

  if (boundary?.source === "relation") {
    return relations.find((relation) => relation.id === boundary.sourceId)?.tags?.name ?? null;
  }

  return null;
}

function isClosedRing(ring: LngLat[]): boolean {
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

function polygonArea(ring: LngLat[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const left = ring[i];
    const right = ring[i + 1];
    if (!left || !right) {
      continue;
    }
    sum += left[0] * right[1] - right[0] * left[1];
  }
  return Math.abs(sum / 2);
}

function readTags(tags: unknown): Record<string, string> | undefined {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return undefined;
  }

  const entries = Object.entries(tags)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort((left, right) => left[0].localeCompare(right[0]));

  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
