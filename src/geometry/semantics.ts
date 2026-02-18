import type { GeoLineString, LngLat } from "../resort-pack/types";
import { distanceMetersBetween, nearestPointOnLineString, type NearestPointOnLine } from "./primitives";

export type PositionBand = "upper" | "mid" | "lower";
export type SkierSide = "left" | "right" | "center";

export type PositionSemantics = {
  fractionAlongRun: number;
  distanceAlongRunMeters: number;
  distanceToCenterlineMeters: number;
  positionBand: PositionBand;
  skierSide: SkierSide;
};

export function classifyPositionSemantics(
  point: LngLat,
  centerline: GeoLineString
): PositionSemantics {
  const nearest = nearestPointOnLineString(point, centerline);
  const segments = buildSegmentLengths(centerline);

  const lengthBeforeSegment = segments
    .slice(0, nearest.segmentIndex)
    .reduce((total, segment) => total + segment, 0);
  const segmentLength = segments[nearest.segmentIndex] ?? 0;
  const distanceAlongRunMeters = lengthBeforeSegment + segmentLength * nearest.t;
  const totalLengthMeters = segments.reduce((total, segment) => total + segment, 0);

  const fractionAlongRun =
    totalLengthMeters > 0 ? clamp(distanceAlongRunMeters / totalLengthMeters, 0, 1) : 0;

  return {
    fractionAlongRun,
    distanceAlongRunMeters,
    distanceToCenterlineMeters: nearest.distanceMeters,
    positionBand: classifyPositionBand(fractionAlongRun),
    skierSide: classifySkierSide(point, centerline, nearest)
  };
}

export function classifyPositionBand(fractionAlongRun: number): PositionBand {
  const normalized = clamp(fractionAlongRun, 0, 1);

  if (normalized < 1 / 3) {
    return "upper";
  }

  if (normalized < 2 / 3) {
    return "mid";
  }

  return "lower";
}

export function classifySkierSide(
  point: LngLat,
  centerline: GeoLineString,
  nearest?: NearestPointOnLine
): SkierSide {
  const nearestPoint = nearest ?? nearestPointOnLineString(point, centerline);
  const start = centerline.coordinates[nearestPoint.segmentIndex];
  const end = centerline.coordinates[nearestPoint.segmentIndex + 1];

  if (!start || !end) {
    throw new Error("Unable to determine centerline segment direction.");
  }

  const anchorLatitude = (start[1] + end[1]) / 2;
  const p = project(point, anchorLatitude);
  const s = project(start, anchorLatitude);
  const e = project(end, anchorLatitude);

  const vectorX = e.x - s.x;
  const vectorY = e.y - s.y;
  const pointX = p.x - s.x;
  const pointY = p.y - s.y;

  const cross = vectorX * pointY - vectorY * pointX;
  const epsilon = 1e-6;

  if (Math.abs(cross) <= epsilon) {
    return "center";
  }

  return cross > 0 ? "left" : "right";
}

function buildSegmentLengths(line: GeoLineString): number[] {
  if (line.coordinates.length < 2) {
    throw new Error("LineString requires at least two coordinates.");
  }

  const lengths: number[] = [];
  for (let index = 0; index < line.coordinates.length - 1; index += 1) {
    const start = line.coordinates[index];
    const end = line.coordinates[index + 1];

    if (!start || !end) {
      continue;
    }

    lengths.push(distanceMetersBetween(start, end));
  }

  return lengths;
}

function project([lon, lat]: LngLat, anchorLatitude: number): { x: number; y: number } {
  const earthRadiusMeters = 6371008.8;
  const lambda = toRadians(lon);
  const phi = toRadians(lat);
  const phi0 = toRadians(anchorLatitude);

  return {
    x: earthRadiusMeters * lambda * Math.cos(phi0),
    y: earthRadiusMeters * phi
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
