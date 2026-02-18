export type LngLat = [number, number];

export type ResortPack = {
  schemaVersion: "1.0.0";
  resort: {
    id: string;
    name: string;
    timezone: string;
  };
  basemap: {
    pmtilesPath: string;
    stylePath: string;
  };
  thresholds: {
    liftProximityMeters: number;
  };
  lifts: Array<{
    id: string;
    name: string;
    towers: Array<{ number: number; coordinates: LngLat }>;
  }>;
  runs: Array<{
    id: string;
    name: string;
    difficulty: "green" | "blue" | "black" | "double-black";
    polygon: {
      type: "Polygon";
      coordinates: LngLat[][];
    };
    centerline: {
      type: "LineString";
      coordinates: LngLat[];
    };
  }>;
};
