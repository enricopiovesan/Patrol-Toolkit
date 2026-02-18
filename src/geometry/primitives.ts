import type { GeoLineString, GeoPolygon, Lift, LngLat, Run } from "../resort-pack/types";

const EARTH_RADIUS_METERS = 6371008.8;

type ProjectedPoint = {
  x: number;
  y: number;
};

export type NearestPointOnLine = {
  point: LngLat;
  distanceMeters: number;
  segmentIndex: number;
  t: number;
};

export type NearestTower = {
  liftId: string;
  liftName: string;
  towerNumber: number;
  coordinates: LngLat;
  distanceMeters: number;
};

export function pointInPolygon(point: LngLat, polygon: GeoPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return false;
  }

  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) {
      continue;
    }

    const [xi, yi] = a;
    const [xj, yj] = b;

    if (isPointOnSegment(point, b, a)) {
      return true;
    }

    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointOnSegment(point: LngLat, segmentStart: LngLat, segmentEnd: LngLat): boolean {
  const epsilon = 1e-12;

  const [px, py] = point;
  const [x1, y1] = segmentStart;
  const [x2, y2] = segmentEnd;

  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= epsilon;
}

export function nearestPointOnLineString(point: LngLat, line: GeoLineString): NearestPointOnLine {
  if (line.coordinates.length < 2) {
    throw new Error("LineString requires at least two coordinates.");
  }

  let best: NearestPointOnLine | null = null;

  for (let segmentIndex = 0; segmentIndex < line.coordinates.length - 1; segmentIndex += 1) {
    const start = line.coordinates[segmentIndex];
    const end = line.coordinates[segmentIndex + 1];

    if (!start || !end) {
      continue;
    }

    const candidate = nearestPointOnSegment(point, start, end, segmentIndex);

    if (!best || candidate.distanceMeters < best.distanceMeters) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("Unable to evaluate nearest point on LineString.");
  }

  return best;
}

export function findRunByContainmentOrNearestCenterline(
  point: LngLat,
  runs: Run[]
): { run: Run; method: "containment" | "centerline"; distanceMeters: number } | null {
  for (const run of runs) {
    if (pointInPolygon(point, run.polygon)) {
      return {
        run,
        method: "containment",
        distanceMeters: 0
      };
    }
  }

  let best: { run: Run; distanceMeters: number } | null = null;
  for (const run of runs) {
    const nearest = nearestPointOnLineString(point, run.centerline);
    if (!best || nearest.distanceMeters < best.distanceMeters) {
      best = { run, distanceMeters: nearest.distanceMeters };
    }
  }

  if (!best) {
    return null;
  }

  return {
    run: best.run,
    method: "centerline",
    distanceMeters: best.distanceMeters
  };
}

export function nearestTower(point: LngLat, lifts: Lift[]): NearestTower | null {
  let best: NearestTower | null = null;

  for (const lift of lifts) {
    for (const tower of lift.towers) {
      const distanceMeters = distanceMetersBetween(point, tower.coordinates);
      if (!best || distanceMeters < best.distanceMeters) {
        best = {
          liftId: lift.id,
          liftName: lift.name,
          towerNumber: tower.number,
          coordinates: tower.coordinates,
          distanceMeters
        };
      }
    }
  }

  return best;
}

export function isWithinThreshold(distanceMeters: number, thresholdMeters: number): boolean {
  if (thresholdMeters < 0) {
    throw new Error("Threshold must be non-negative.");
  }

  return distanceMeters <= thresholdMeters;
}

export function distanceMetersBetween(a: LngLat, b: LngLat): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dPhi = toRadians(lat2 - lat1);
  const dLambda = toRadians(lon2 - lon1);

  const h =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestPointOnSegment(
  point: LngLat,
  start: LngLat,
  end: LngLat,
  segmentIndex: number
): NearestPointOnLine {
  const anchorLatitude = (start[1] + end[1]) / 2;
  const p = project(point, anchorLatitude);
  const s = project(start, anchorLatitude);
  const e = project(end, anchorLatitude);

  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const segmentLengthSq = dx * dx + dy * dy;

  let t = 0;
  if (segmentLengthSq > 0) {
    t = ((p.x - s.x) * dx + (p.y - s.y) * dy) / segmentLengthSq;
  }

  const clampedT = clamp(t, 0, 1);
  const nearestProjected: ProjectedPoint = {
    x: s.x + dx * clampedT,
    y: s.y + dy * clampedT
  };

  const nearest: LngLat = unproject(nearestProjected, anchorLatitude);
  return {
    point: nearest,
    distanceMeters: distanceMetersBetween(point, nearest),
    segmentIndex,
    t: clampedT
  };
}

function project([lon, lat]: LngLat, anchorLatitude: number): ProjectedPoint {
  const lambda = toRadians(lon);
  const phi = toRadians(lat);
  const phi0 = toRadians(anchorLatitude);

  return {
    x: EARTH_RADIUS_METERS * lambda * Math.cos(phi0),
    y: EARTH_RADIUS_METERS * phi
  };
}

function unproject(point: ProjectedPoint, anchorLatitude: number): LngLat {
  const phi0 = toRadians(anchorLatitude);
  const lon = toDegrees(point.x / (EARTH_RADIUS_METERS * Math.cos(phi0)));
  const lat = toDegrees(point.y / EARTH_RADIUS_METERS);
  return [lon, lat];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
