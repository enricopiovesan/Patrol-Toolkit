import {
  distanceMetersBetween,
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

export type RadioPhraseOutcomeV2 = RadioPhraseOutcome & {
  confidence: "high" | "medium" | "low";
  mode: "run+lift" | "run-only" | "lift-only" | "fallback";
};

export function composeRadioPhraseV2(point: LngLat, pack: ResortPack): RadioPhraseOutcomeV2 {
  const context = buildPhraseContext(point, pack);
  const decision = decidePhrase(context);
  return renderPhrase(decision);
}

export function composeRadioPhrase(point: LngLat, pack: ResortPack): RadioPhraseOutcome {
  const outcome = composeRadioPhraseV2(point, pack);
  return {
    phrase: outcome.phrase,
    runId: outcome.runId,
    liftId: outcome.liftId
  };
}

function formatPositionBand(value: "upper" | "mid" | "lower"): string {
  if (value === "upper") {
    return "top section";
  }
  if (value === "mid") {
    return "middle section";
  }
  return "bottom section";
}

function formatRelativeRelation(pointFraction: number, anchorFraction: number): "above" | "below" | "from" {
  const delta = pointFraction - anchorFraction;
  if (Math.abs(delta) < 0.03) {
    return "from";
  }
  return delta < 0 ? "above" : "below";
}

function roundToNearest10Meters(distanceMeters: number): number {
  return Math.max(0, Math.round(distanceMeters / 10) * 10);
}

type PhraseContext = {
  point: LngLat;
  runMatch: ReturnType<typeof findRunByContainmentOrNearestCenterline>;
  nearestLiftTower: ReturnType<typeof nearestTower>;
  liftInRange: boolean;
  runSemantics: ReturnType<typeof classifyPositionSemantics> | null;
  runIntersectionAnchor: RunIntersectionAnchor | null;
};

type PhraseDecision =
  | {
      kind: "run+lift";
      phraseParts: {
        runName: string;
        positionBand: "upper" | "mid" | "lower";
        distanceMeters: number;
        relation: "above" | "below" | "from";
        liftName: string;
        towerNumber: number;
      };
      runId: string;
      liftId: string;
      confidence: "high";
    }
  | {
      kind: "run+lift-far";
      phraseParts: {
        runName: string;
        positionBand: "upper" | "mid" | "lower";
        distanceMeters: number;
        relation: "above" | "below" | "from";
        liftName: string;
        towerNumber: number;
      };
      runId: string;
      liftId: string;
      confidence: "medium";
    }
  | {
      kind: "run-only-anchor";
      phraseParts: {
        runName: string;
        positionBand: "upper" | "mid" | "lower";
        distanceMeters: number;
        direction: "north" | "south" | "east" | "west";
        anchorRunName: string;
      };
      runId: string;
      confidence: "high";
    }
  | {
      kind: "run-only-base";
      phraseParts: {
        runName: string;
        positionBand: "upper" | "mid" | "lower";
      };
      runId: string;
      confidence: "medium";
    }
  | {
      kind: "lift-only";
      phraseParts: {
        distanceMeters: number;
        liftName: string;
        towerNumber: number;
      };
      liftId: string;
      confidence: "medium";
    }
  | {
      kind: "fallback";
      confidence: "low";
    };

function buildPhraseContext(point: LngLat, pack: ResortPack): PhraseContext {
  const runMatch = findRunByContainmentOrNearestCenterline(point, pack.runs);
  const nearestLiftTower = nearestTower(point, pack.lifts);
  const liftInRange = nearestLiftTower
    ? isWithinThreshold(nearestLiftTower.distanceMeters, pack.thresholds.liftProximityMeters)
    : false;
  const runSemantics = runMatch ? classifyPositionSemantics(point, runMatch.run.centerline) : null;
  const runIntersectionAnchor = runMatch ? nearestRunIntersectionAnchor(point, runMatch.run.id, pack.runs) : null;

  return {
    point,
    runMatch,
    nearestLiftTower,
    liftInRange,
    runSemantics,
    runIntersectionAnchor
  };
}

function decidePhrase(context: PhraseContext): PhraseDecision {
  if (context.runMatch && context.runSemantics) {
    if (context.nearestLiftTower && context.liftInRange) {
      const towerSemantics = classifyPositionSemantics(
        context.nearestLiftTower.coordinates,
        context.runMatch.run.centerline
      );

      return {
        kind: "run+lift",
        phraseParts: {
          runName: context.runMatch.run.name,
          positionBand: context.runSemantics.positionBand,
          distanceMeters: roundToNearest10Meters(context.nearestLiftTower.distanceMeters),
          relation: formatRelativeRelation(context.runSemantics.fractionAlongRun, towerSemantics.fractionAlongRun),
          liftName: context.nearestLiftTower.liftName,
          towerNumber: context.nearestLiftTower.towerNumber
        },
        runId: context.runMatch.run.id,
        liftId: context.nearestLiftTower.liftId,
        confidence: "high"
      };
    }

    if (context.runIntersectionAnchor) {
      return {
        kind: "run-only-anchor",
        phraseParts: {
          runName: context.runMatch.run.name,
          positionBand: context.runSemantics.positionBand,
          distanceMeters: context.runIntersectionAnchor.distanceMeters,
          direction: cardinalDirectionFromTo(context.runIntersectionAnchor.coordinates, context.point),
          anchorRunName: context.runIntersectionAnchor.runName
        },
        runId: context.runMatch.run.id,
        confidence: "high"
      };
    }

    if (context.nearestLiftTower) {
      const towerSemantics = classifyPositionSemantics(
        context.nearestLiftTower.coordinates,
        context.runMatch.run.centerline
      );

      return {
        kind: "run+lift-far",
        phraseParts: {
          runName: context.runMatch.run.name,
          positionBand: context.runSemantics.positionBand,
          distanceMeters: roundToNearest10Meters(context.nearestLiftTower.distanceMeters),
          relation: formatRelativeRelation(context.runSemantics.fractionAlongRun, towerSemantics.fractionAlongRun),
          liftName: context.nearestLiftTower.liftName,
          towerNumber: context.nearestLiftTower.towerNumber
        },
        runId: context.runMatch.run.id,
        liftId: context.nearestLiftTower.liftId,
        confidence: "medium"
      };
    }

    return {
      kind: "run-only-base",
      phraseParts: {
        runName: context.runMatch.run.name,
        positionBand: context.runSemantics.positionBand
      },
      runId: context.runMatch.run.id,
      confidence: "medium"
    };
  }

  if (context.nearestLiftTower && context.liftInRange) {
    return {
      kind: "lift-only",
      phraseParts: {
        distanceMeters: roundToNearest10Meters(context.nearestLiftTower.distanceMeters),
        liftName: context.nearestLiftTower.liftName,
        towerNumber: context.nearestLiftTower.towerNumber
      },
      liftId: context.nearestLiftTower.liftId,
      confidence: "medium"
    };
  }

  return {
    kind: "fallback",
    confidence: "low"
  };
}

function renderPhrase(decision: PhraseDecision): RadioPhraseOutcomeV2 {
  if (decision.kind === "run+lift") {
    return {
      phrase: `${decision.phraseParts.runName}, ${formatPositionBand(decision.phraseParts.positionBand)}, ${decision.phraseParts.distanceMeters}m ${decision.phraseParts.relation} ${decision.phraseParts.liftName} tower ${decision.phraseParts.towerNumber}`,
      runId: decision.runId,
      liftId: decision.liftId,
      confidence: decision.confidence,
      mode: "run+lift"
    };
  }

  if (decision.kind === "run+lift-far") {
    return {
      phrase: `${decision.phraseParts.runName}, ${formatPositionBand(decision.phraseParts.positionBand)}, ${decision.phraseParts.distanceMeters}m ${decision.phraseParts.relation} ${decision.phraseParts.liftName} tower ${decision.phraseParts.towerNumber}`,
      runId: decision.runId,
      liftId: decision.liftId,
      confidence: decision.confidence,
      mode: "run+lift"
    };
  }

  if (decision.kind === "run-only-anchor") {
    return {
      phrase: `${decision.phraseParts.runName}, ${formatPositionBand(decision.phraseParts.positionBand)}, ${decision.phraseParts.distanceMeters}m ${decision.phraseParts.direction} from intersection with ${decision.phraseParts.anchorRunName}`,
      runId: decision.runId,
      liftId: null,
      confidence: decision.confidence,
      mode: "run-only"
    };
  }

  if (decision.kind === "run-only-base") {
    return {
      phrase: `${decision.phraseParts.runName}, ${formatPositionBand(decision.phraseParts.positionBand)}`,
      runId: decision.runId,
      liftId: null,
      confidence: decision.confidence,
      mode: "run-only"
    };
  }

  if (decision.kind === "lift-only") {
    return {
      phrase: `${decision.phraseParts.distanceMeters}m from ${decision.phraseParts.liftName} tower ${decision.phraseParts.towerNumber}`,
      runId: null,
      liftId: decision.liftId,
      confidence: decision.confidence,
      mode: "lift-only"
    };
  }

  return {
    phrase: "Location uncertain",
    runId: null,
    liftId: null,
    confidence: decision.confidence,
    mode: "fallback"
  };
}

function cardinalDirectionFromTo(from: LngLat, to: LngLat): "north" | "south" | "east" | "west" {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  const deltaLat = toLat - fromLat;
  const deltaLon = toLon - fromLon;

  if (Math.abs(deltaLat) >= Math.abs(deltaLon)) {
    return deltaLat >= 0 ? "north" : "south";
  }

  return deltaLon >= 0 ? "east" : "west";
}

type RunIntersectionAnchor = {
  runName: string;
  coordinates: LngLat;
  distanceMeters: number;
};

function nearestRunIntersectionAnchor(point: LngLat, activeRunId: string, runs: ResortPack["runs"]): RunIntersectionAnchor | null {
  const activeRun = runs.find((run) => run.id === activeRunId);
  if (!activeRun) {
    return null;
  }

  let best: RunIntersectionAnchor | null = null;
  for (const otherRun of runs) {
    if (otherRun.id === activeRunId) {
      continue;
    }

    const intersection = firstLineIntersection(activeRun.centerline.coordinates, otherRun.centerline.coordinates);
    if (!intersection) {
      continue;
    }

    const distance = roundToNearest10Meters(distanceMetersBetween(point, intersection));
    if (distance > 200) {
      continue;
    }

    if (!best || distance < best.distanceMeters) {
      best = {
        runName: otherRun.name,
        coordinates: intersection,
        distanceMeters: distance
      };
    }
  }

  return best;
}

function firstLineIntersection(a: LngLat[], b: LngLat[]): LngLat | null {
  for (let i = 0; i < a.length - 1; i += 1) {
    const a1 = a[i];
    const a2 = a[i + 1];
    if (!a1 || !a2) {
      continue;
    }
    for (let j = 0; j < b.length - 1; j += 1) {
      const b1 = b[j];
      const b2 = b[j + 1];
      if (!b1 || !b2) {
        continue;
      }
      const hit = segmentIntersection(a1, a2, b1, b2);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

function segmentIntersection(p1: LngLat, p2: LngLat, q1: LngLat, q2: LngLat): LngLat | null {
  const x1 = p1[0];
  const y1 = p1[1];
  const x2 = p2[0];
  const y2 = p2[1];
  const x3 = q1[0];
  const y3 = q1[1];
  const x4 = q2[0];
  const y4 = q2[1];

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-12) {
    return null;
  }

  const tNumerator = (x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4);
  const uNumerator = (x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2);
  const t = tNumerator / denominator;
  const u = uNumerator / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

export function composeTowerPhrase(tower: NearestTower): string {
  return `Near ${tower.liftName} tower ${tower.towerNumber}`;
}
