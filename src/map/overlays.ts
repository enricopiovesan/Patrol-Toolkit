import type { ResortPack } from "../resort-pack/types";
import { smoothLineString, smoothPolygonRing } from "./geometry-smoothing";

const RUN_SMOOTHING_PASSES = 3;
const AREA_RING_SMOOTHING_PASSES = 4;

export type ResortOverlayData = {
  boundary: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  terrainBands: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  areas: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  contours: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  peaks: GeoJSON.FeatureCollection<GeoJSON.Point>;
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
      geometry: {
        type: "LineString",
        coordinates: smoothLineString(run.centerline.coordinates, RUN_SMOOTHING_PASSES)
      },
      properties: {
        id: run.id,
        name: run.name,
        difficulty: run.difficulty
      }
    })) ?? [];

  const contourFeatures: GeoJSON.Feature<GeoJSON.LineString>[] =
    pack?.contours?.map((contour) => ({
      type: "Feature",
      geometry: contour.line,
      properties: {
        id: contour.id,
        elevationMeters: contour.elevationMeters ?? null
      }
    })) ?? [];

  const peakFeatures: GeoJSON.Feature<GeoJSON.Point>[] =
    pack?.peaks?.map((peak) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: peak.coordinates
      },
      properties: {
        id: peak.id,
        name: peak.name,
        elevationMeters: peak.elevationMeters ?? null
      }
    })) ?? [];

  const areaFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] =
    pack?.areas?.map((area) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: area.perimeter.coordinates.map((ring, index) =>
          index === 0
            ? smoothPolygonRing(ring, AREA_RING_SMOOTHING_PASSES)
            : smoothPolygonRing(ring, Math.max(2, AREA_RING_SMOOTHING_PASSES - 2))
        )
      },
      properties: {
        id: area.id,
        name: area.name,
        kind: area.kind
      }
    })) ?? [];

  const terrainBandFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] =
    pack?.terrainBands?.map((band) => {
      const min = band.elevationMinMeters ?? null;
      const max = band.elevationMaxMeters ?? null;
      const mid =
        typeof min === "number" && typeof max === "number" && Number.isFinite(min) && Number.isFinite(max)
          ? (min + max) / 2
          : typeof min === "number" && Number.isFinite(min)
            ? min
            : typeof max === "number" && Number.isFinite(max)
              ? max
              : null;
      return {
        type: "Feature",
        geometry: band.polygon,
        properties: {
          id: band.id,
          elevationMinMeters: min,
          elevationMaxMeters: max,
          elevationMidMeters: mid
        }
      };
    }) ?? [];

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
    terrainBands: featureCollection(terrainBandFeatures),
    areas: featureCollection(areaFeatures),
    contours: featureCollection(contourFeatures),
    peaks: featureCollection(peakFeatures),
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
