import {
  findRunByContainmentOrNearestCenterline,
  isWithinThreshold,
  nearestTower,
  type NearestTower
} from "../geometry/primitives";
import { classifyPositionSemantics } from "../geometry/semantics";
import type { LngLat, ResortPack } from "../resort-pack/types";

export type RadioPhraseOutcome = {
  phrase: string;
  runId: string | null;
  liftId: string | null;
};

export function composeRadioPhrase(point: LngLat, pack: ResortPack): RadioPhraseOutcome {
  const runMatch = findRunByContainmentOrNearestCenterline(point, pack.runs);
  const nearestLiftTower = nearestTower(point, pack.lifts);
  const liftInRange = nearestLiftTower
    ? isWithinThreshold(nearestLiftTower.distanceMeters, pack.thresholds.liftProximityMeters)
    : false;

  if (runMatch) {
    const semantics = classifyPositionSemantics(point, runMatch.run.centerline);

    const basePhrase = `${runMatch.run.name}, ${capitalize(semantics.positionBand)}, ${formatSide(
      semantics.skierSide
    )}`;

    if (nearestLiftTower && liftInRange) {
      return {
        phrase: `${basePhrase}, below ${nearestLiftTower.liftName} tower ${nearestLiftTower.towerNumber}`,
        runId: runMatch.run.id,
        liftId: nearestLiftTower.liftId
      };
    }

    return {
      phrase: basePhrase,
      runId: runMatch.run.id,
      liftId: null
    };
  }

  if (nearestLiftTower && liftInRange) {
    return {
      phrase: `Near ${nearestLiftTower.liftName} tower ${nearestLiftTower.towerNumber}`,
      runId: null,
      liftId: nearestLiftTower.liftId
    };
  }

  return {
    phrase: "Location unknown",
    runId: null,
    liftId: null
  };
}

function formatSide(side: "left" | "right" | "center"): string {
  if (side === "left") {
    return "skier's left";
  }

  if (side === "right") {
    return "skier's right";
  }

  return "centerline";
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export function composeTowerPhrase(tower: NearestTower): string {
  return `Near ${tower.liftName} tower ${tower.towerNumber}`;
}
