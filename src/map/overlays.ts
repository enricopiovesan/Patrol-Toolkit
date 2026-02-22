import type { ResortPack } from "../resort-pack/types";

export type ResortOverlayData = {
  boundary: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  areas: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  runs: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  lifts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  liftTowers: GeoJSON.FeatureCollection<GeoJSON.Point>;
};

export function buildResortOverlayData(pack: ResortPack | null): ResortOverlayData {
  const boundaryFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  if (pack?.boundary) {
    boundaryFeatures.push({
      type: "Feature",
      geometry: pack.boundary,
      properties: {
        resortId: pack.resort.id
      }
    });
  }

  const runFeatures: GeoJSON.Feature<GeoJSON.LineString>[] =
    pack?.runs.map((run) => ({
      type: "Feature",
      geometry: run.centerline,
      properties: {
        id: run.id,
        name: run.name,
        difficulty: run.difficulty
      }
    })) ?? [];

  const areaFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] =
    pack?.areas?.map((area) => ({
      type: "Feature",
      geometry: area.perimeter,
      properties: {
        id: area.id,
        name: area.name,
        kind: area.kind
      }
    })) ?? [];

  const liftLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const towerFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const lift of pack?.lifts ?? []) {
    const coordinates = lift.towers.map((tower) => tower.coordinates);
    if (coordinates.length >= 2) {
      liftLineFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates
        },
        properties: {
          id: lift.id,
          name: lift.name
        }
      });
    }

    for (const tower of lift.towers) {
      towerFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: tower.coordinates
        },
        properties: {
          liftId: lift.id,
          liftName: lift.name,
          towerNumber: tower.number
        }
      });
    }
  }

  return {
    boundary: featureCollection(boundaryFeatures),
    areas: featureCollection(areaFeatures),
    runs: featureCollection(runFeatures),
    lifts: featureCollection(liftLineFeatures),
    liftTowers: featureCollection(towerFeatures)
  };
}

function featureCollection<T extends GeoJSON.Geometry>(features: GeoJSON.Feature<T>[]): GeoJSON.FeatureCollection<T> {
  return {
    type: "FeatureCollection",
    features
  };
}
