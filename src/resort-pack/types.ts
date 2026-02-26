export type LngLat = [number, number];

export type GeoLineString = {
  type: "LineString";
  coordinates: LngLat[];
};

export type GeoPolygon = {
  type: "Polygon";
  coordinates: LngLat[][];
};

export type ResortAreaKind = "ridge" | "bowl" | "zone" | "section" | "area";

export type ResortArea = {
  id: string;
  name: string;
  kind: ResortAreaKind;
  perimeter: GeoPolygon;
};

export type LiftTower = {
  number: number;
  coordinates: LngLat;
};

export type Lift = {
  id: string;
  name: string;
  towers: LiftTower[];
};

export type RunDifficulty = "green" | "blue" | "black" | "double-black";

export type Run = {
  id: string;
  name: string;
  difficulty: RunDifficulty;
  polygon: GeoPolygon;
  centerline: GeoLineString;
};

export type ContourLine = {
  id: string;
  elevationMeters?: number;
  line: GeoLineString;
};

export type TerrainBand = {
  id: string;
  polygon: GeoPolygon;
  elevationMinMeters?: number;
  elevationMaxMeters?: number;
};

export type Peak = {
  id: string;
  name: string;
  coordinates: LngLat;
  elevationMeters?: number;
};

export type ResortPack = {
  schemaVersion: "1.0.0";
  resort: {
    id: string;
    name: string;
    timezone: string;
  };
  boundary?: GeoPolygon;
  basemap: {
    pmtilesPath: string;
    stylePath: string;
  };
  thresholds: {
    liftProximityMeters: number;
  };
  areas?: ResortArea[];
  terrainBands?: TerrainBand[];
  contours?: ContourLine[];
  peaks?: Peak[];
  lifts: Lift[];
  runs: Run[];
};

export type ResortPackValidationIssue = {
  code:
    | "invalid_json"
    | "schema_violation"
    | "invalid_timezone"
    | "offline_path_required"
    | "duplicate_id"
    | "duplicate_tower_number"
    | "invalid_geometry";
  path: string;
  message: string;
};

export type ResortPackValidationResult =
  | { ok: true; value: ResortPack }
  | { ok: false; errors: ResortPackValidationIssue[] };
