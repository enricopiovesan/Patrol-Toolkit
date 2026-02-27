export function smoothLineString(
  coordinates: readonly [number, number][],
  iterations: number
): [number, number][] {
  if (iterations <= 0 || coordinates.length < 3) {
    return coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  }

  let current = coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  for (let index = 0; index < iterations; index += 1) {
    current = chaikinOpen(current);
    if (current.length < 3) {
      break;
    }
  }

  return current;
}

export function smoothPolygonRing(
  coordinates: readonly [number, number][],
  iterations: number
): [number, number][] {
  if (iterations <= 0 || coordinates.length < 4) {
    return coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  }

  const isClosed = isRingClosed(coordinates);
  const ring = isClosed ? coordinates.slice(0, -1) : coordinates;
  if (ring.length < 3) {
    return coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  }

  let current = ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  for (let index = 0; index < iterations; index += 1) {
    current = chaikinClosed(current);
    if (current.length < 3) {
      break;
    }
  }

  const closedRing = current.concat([[current[0][0], current[0][1]]]);
  return closedRing;
}

function isRingClosed(coordinates: readonly [number, number][]): boolean {
  if (coordinates.length < 2) {
    return false;
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function chaikinOpen(coordinates: readonly [number, number][]): [number, number][] {
  if (coordinates.length < 2) {
    return coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);
  }

  const smoothed: [number, number][] = [[coordinates[0][0], coordinates[0][1]]];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const first = coordinates[index];
    const second = coordinates[index + 1];
    smoothed.push(interpolate(first, second, 0.25));
    smoothed.push(interpolate(first, second, 0.75));
  }
  smoothed.push([coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][1]]);
  return smoothed;
}

function chaikinClosed(coordinates: readonly [number, number][]): [number, number][] {
  const smoothed: [number, number][] = [];
  for (let index = 0; index < coordinates.length; index += 1) {
    const first = coordinates[index];
    const second = coordinates[(index + 1) % coordinates.length];
    smoothed.push(interpolate(first, second, 0.25));
    smoothed.push(interpolate(first, second, 0.75));
  }
  return smoothed;
}

function interpolate(
  first: readonly [number, number],
  second: readonly [number, number],
  factor: number
): [number, number] {
  return [
    first[0] + (second[0] - first[0]) * factor,
    first[1] + (second[1] - first[1]) * factor
  ];
}
