# Phrase v2 Spec

## Purpose
- Improve patrol radio phrase usefulness while keeping output deterministic and short.
- Keep compatibility with offline-first operation and existing pack geometry inputs.

## Output Contract

`composeRadioPhraseV2(point, pack) -> RadioPhraseOutcomeV2`

Required fields:
- `phrase: string`
- `runId: string | null`
- `liftId: string | null`
- `confidence: "high" | "medium" | "low"`
- `mode: "run+lift" | "run-only" | "lift-only" | "fallback"`

Optional fields:
- `runName?: string`
- `liftName?: string`
- `towerNumber?: number`
- `positionBand?: "upper" | "mid" | "lower" | "unknown"`
- `skierSide?: "left" | "right" | "center" | "unknown"`
- `notes?: string[]`

## Phrase Templates

Primary:
- `"{runName}, {positionBand}, {distanceM}m {above|below|from} {liftName} tower {n}"`

Run-only:
- `"{runName}, {positionBand}, {distanceM}m {north|south|east|west} from intersection with {runName}"` when anchor is available
- `"{runName}, {positionBand}"` when no reliable anchor is available

Lift-only:
- `"{distanceM}m from {liftName} tower {n}"`

Fallback:
- `"Location uncertain"`

## Anchor Wording Policy (Objective Only)

- Do not use vague language like `near` or `close to`.
- Prefer objective references:
  - `"{distanceM}m above {anchor}"`
  - `"{distanceM}m below {anchor}"`
- If above/below cannot be determined with confidence:
  - use `"{distanceM}m from {anchor}"`.
- Cardinal directions (`north/south/east/west`) are last-resort only.
- Distances are rounded to the nearest `10m`.

## Confidence Rules

`high`:
- valid run match and valid semantics; and optional nearby lift in threshold when present.

`medium`:
- run match exists but semantics uncertain (e.g. centerline/weak side), or only lift-only phrase.

`low`:
- no robust run/lift context; fallback mode.

## Scenario Matrix

1. Normal run + nearby lift:
- mode: `run+lift`
- confidence: `high`
  - phrase includes objective anchor distance + relation.

2. Run matched, no nearby lift:
- mode: `run-only`
- confidence: `high`

3. Run matched, side ambiguous:
- mode: `run-only`
- phrase should avoid false precision and prioritize objective anchors.
- confidence: `medium`

4. No run, nearby lift:
- mode: `lift-only`
- confidence: `medium`

5. No run, no lift:
- mode: `fallback`
- confidence: `low`

6. Geometry available but borderline thresholds:
- deterministic tie-break required (current nearest/containment order preserved).
- confidence downgraded to `medium` if ambiguity remains.

## Determinism Requirements

- Same input point + same pack -> same phrase and metadata.
- No randomization.
- No network calls.

## Backward Compatibility

- Keep existing `composeRadioPhrase(...)` for v1 behavior during migration.
- Add `composeRadioPhraseV2(...)` and run side-by-side tests.
- Switch UI to v2 only after acceptance tests pass.

## Acceptance Examples (v2)

1. Run + lift:
- output mode: `run+lift`
- phrase pattern: `"Easy Street, middle section, 40m below Summit Express tower 2"`

2. Run only:
- output mode: `run-only`
- phrase pattern: `"Easy Street, middle section, 20m above intersection with Crystal Bowl"`

3. Lift only:
- output mode: `lift-only`
- phrase pattern: `"30m above Summit Express tower 1"`

4. Fallback:
- output mode: `fallback`
- phrase pattern: `"Location uncertain"`

## Open Decisions For Review

1. Should fallback phrase include confidence text (example: `"Location uncertain, verify visually"`), or stay minimal?
2. For ambiguous side, should wording be `"centerline"` or `"side unclear"`?
3. Distance rounding step fixed: nearest `10m`.
