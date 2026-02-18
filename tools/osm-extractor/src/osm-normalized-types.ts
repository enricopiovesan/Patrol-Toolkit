export type LngLat = [number, number];

export type NormalizedLineString = {
  type: "LineString";
  coordinates: LngLat[];
};

export type NormalizedBoundary = {
  source: "relation" | "way";
  sourceId: number;
  polygon: {
    type: "Polygon";
    coordinates: [LngLat[]];
  };
};

export type NormalizedLift = {
  id: string;
  name: string;
  kind: string;
  sourceWayId: number;
  line: NormalizedLineString;
  towers: Array<{
    number: number;
    coordinates: LngLat;
  }>;
};

export type NormalizedRun = {
  id: string;
  name: string;
  difficulty: string | null;
  sourceWayId: number;
  centerline: NormalizedLineString;
};

export type NormalizedResortSource = {
  schemaVersion: "0.2.0";
  resort: {
    id: string;
    name: string;
  };
  source: {
    format: "osm-overpass-json";
    sha256: string;
    inputPath: string | null;
    osmBaseTimestamp: string | null;
  };
  boundary: NormalizedBoundary | null;
  lifts: NormalizedLift[];
  runs: NormalizedRun[];
  warnings: string[];
};

