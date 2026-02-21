# Roadmap v2

## Scope
- Build on v1 completion with two top priorities first:
  - phrase quality (operationally useful radio calls)
  - run visualization quality (lines, difficulty colors, labels)
- Keep offline-first behavior as a hard requirement.
- Reuse ideas from openskimap where useful, adapted to Patrol Toolkit constraints.

## Slice 1: Phrase v2 Discovery + Spec
- Status: completed
- Goal: define a better phrase system before coding.
- Changes:
  - run structured brainstorm on phrase outputs by scenario (normal, low confidence, no nearby run/lift, ambiguous side).
  - define phrase contract: required fields, optional enrichments, fallback wording.
  - define acceptance examples in fixtures.
  - embed Phrase v2 spec in this roadmap (single source of truth).
- Test:
  - spec review with sample inputs/outputs approved.
- PR outcome: locked phrase spec for implementation.

### Phrase v2 Spec (Embedded)

Purpose:
- Improve patrol radio phrase usefulness while keeping output deterministic and short.
- Keep compatibility with offline-first operation and existing pack geometry inputs.

Output contract:
- `composeRadioPhraseV2(point, pack) -> RadioPhraseOutcomeV2`
- Required fields:
  - `phrase: string`
  - `runId: string | null`
  - `liftId: string | null`
  - `confidence: "high" | "medium" | "low"`
  - `mode: "run+lift" | "run-only" | "lift-only" | "fallback"`
- Optional fields:
  - `runName?: string`
  - `liftName?: string`
  - `towerNumber?: number`
  - `positionBand?: "upper" | "mid" | "lower" | "unknown"`
  - `skierSide?: "left" | "right" | "center" | "unknown"`
  - `notes?: string[]`

Phrase templates:
- Primary:
  - `"{runName}, {positionBand}, {distanceM}m {above|below|from} {liftName} tower {n}"`
- Run-only:
  - `"{runName}, {positionBand}, {distanceM}m {north|south|east|west} from intersection with {runName}"` when anchor is available.
  - `"{runName}, {positionBand}"` when no reliable anchor is available.
- Lift-only:
  - `"{distanceM}m from {liftName} tower {n}"`
- Fallback:
  - `"Location uncertain"`

Anchor wording policy (objective only):
- Do not use vague language like `near` or `close to`.
- Prefer objective references:
  - `"{distanceM}m above {anchor}"`
  - `"{distanceM}m below {anchor}"`
- If above/below cannot be determined with confidence:
  - use `"{distanceM}m from {anchor}"`.
- Cardinal directions (`north/south/east/west`) are last-resort only.
- Distances are rounded to the nearest `10m`.

Confidence rules:
- `high`:
  - valid run match and valid semantics; and optional nearby lift in threshold when present.
- `medium`:
  - run match exists but semantics uncertain, or only lift-only phrase.
- `low`:
  - no robust run/lift context; fallback mode.

Scenario matrix:
1. Normal run + nearby lift:
- mode: `run+lift`
- confidence: `high`
- phrase includes objective anchor distance + relation.
2. Run matched, no nearby lift:
- mode: `run-only`
- confidence: `high`
3. Run matched, side ambiguous:
- mode: `run-only`
- phrase avoids false precision and prioritizes objective anchors.
- confidence: `medium`
4. No run, nearby lift:
- mode: `lift-only`
- confidence: `medium`
5. No run, no lift:
- mode: `fallback`
- confidence: `low`
6. Borderline thresholds:
- deterministic tie-break required (nearest/containment order preserved).
- confidence downgraded to `medium` if ambiguity remains.

Determinism requirements:
- Same input point + same pack -> same phrase and metadata.
- No randomization.
- No network calls.

Backward compatibility:
- Keep existing `composeRadioPhrase(...)` for v1 behavior during migration.
- Add `composeRadioPhraseV2(...)` and run side-by-side tests.
- Switch UI to v2 only after acceptance tests pass.

Acceptance examples:
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

## Slice 2: Phrase v2 Engine
- Status: completed
- Goal: implement phrase improvements from Slice 1.
- Changes:
  - refactor phrase generation into explicit stages (context -> decision -> render).
  - improve wording quality and consistency.
  - include confidence-aware fallbacks.
- Test:
  - deterministic unit tests for all phrase scenarios from spec.
- PR outcome: production-ready phrase behavior.

## Slice 3: Run Rendering v2 (Lines + Difficulty Colors)
- Status: completed
- Goal: replace triangle-like run display with readable line cartography.
- Changes:
  - render runs as line-first visualization.
  - map difficulty to stable color palette.
  - ensure line width/opacity scale is legible across zoom levels.
  - reference openskimap visual conventions where compatible.
- Test:
  - manual visual validation online/offline on Kicking Horse.
  - unit tests for difficulty->style mapping.
- PR outcome: runs are visually correct and readable.

## Slice 4: Run Labels v2
- Status: completed
- Goal: add useful run names without clutter.
- Changes:
  - add run name symbol layer.
  - tune label placement/collision/priority rules.
  - zoom gating for readability.
- Test:
  - manual checks for dense areas and small screens.
  - regression tests for label style config.
- PR outcome: labeled map that remains readable.

## Slice 5: Basemap Regeneration Controls
- Status: completed
- Goal: make rebuild intent explicit and safe.
- Changes:
  - add menu option to force basemap rebuild for current version.
  - add dry-run preview of rebuild inputs (extract, bbox, zoom, provider command).
- Test:
  - force rebuild regenerates artifacts.
  - dry-run prints deterministic plan with no writes.
- PR outcome: predictable regeneration workflow.

## Slice 6: Offline Diagnostics + SW Hardening
- Status: completed
- Goal: make offline failures diagnosable and rarer.
- Changes:
  - [x] add runtime diagnostics in UI warning (online state, SW control state, style/pmtiles paths).
  - [x] add debug diagnostics for style URL, pmtiles URL, cache/SW state.
  - [x] formalize cache migration/version behavior.
  - [x] strengthen range/cache tests for PMTiles.
- Test:
  - offline failure simulation tests pass.
  - update from previous SW version remains functional.
- PR outcome: robust offline runtime.

## Slice 7: Multi-Resort Validation + Integrity
- Status: completed
- Goal: verify robustness across resorts and artifacts.
- Changes:
  - [x] add CLI published integrity audit (catalog -> pack -> basemap assets).
  - [x] validate multiple resorts across regions.
  - [x] enforce publish gate: manual validation + readiness `ready` (prevent invalid published packs).
  - [x] add menu `Unpublish resort` (remove app catalog + published assets without deleting resort data).
  - [x] harden boundary detection against far weak matches and improve local relevance for resort boundaries.
- Test:
  - [x] full extractor check suite passes after integrity hardening.
  - [x] published invalid pack regression covered (no auto-publish when readiness incomplete).
- PR outcome: broader production confidence.

## Slice 8: Docs/Runbook v2 + Exit Signoff
- Status: planned
- Goal: close v2 with operable documentation and evidence.
- Changes:
  - update docs/runbook with phrase and visualization behavior.
  - add troubleshooting matrix and upgrade notes.
  - capture final evidence bundle (timings, artifact sizes, screenshots/checklists).
- Test:
  - clean-machine walkthrough succeeds from docs only.
  - final acceptance checklist fully checked.
- PR outcome: v2 closure with auditable evidence.
