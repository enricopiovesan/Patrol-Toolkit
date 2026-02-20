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
  - track spec in `roadmaps/roadmap_v2_phrase_spec.md`.
- Test:
  - spec review with sample inputs/outputs approved.
- PR outcome: locked phrase spec for implementation.

## Slice 2: Phrase v2 Engine
- Status: in progress
- Goal: implement phrase improvements from Slice 1.
- Changes:
  - refactor phrase generation into explicit stages (context -> decision -> render).
  - improve wording quality and consistency.
  - include confidence-aware fallbacks.
- Test:
  - deterministic unit tests for all phrase scenarios from spec.
- PR outcome: production-ready phrase behavior.

## Slice 3: Run Rendering v2 (Lines + Difficulty Colors)
- Status: planned
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
- Status: planned
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
- Status: planned
- Goal: make rebuild intent explicit and safe.
- Changes:
  - add menu option to force basemap rebuild for current version.
  - add dry-run preview of rebuild inputs (extract, bbox, zoom, provider command).
- Test:
  - force rebuild regenerates artifacts.
  - dry-run prints deterministic plan with no writes.
- PR outcome: predictable regeneration workflow.

## Slice 6: Offline Diagnostics + SW Hardening
- Status: planned
- Goal: make offline failures diagnosable and rarer.
- Changes:
  - add debug diagnostics for style URL, pmtiles URL, cache/SW state.
  - formalize cache migration/version behavior.
  - strengthen range/cache tests for PMTiles.
- Test:
  - offline failure simulation tests pass.
  - update from previous SW version remains functional.
- PR outcome: robust offline runtime.

## Slice 7: Multi-Resort Validation + Integrity
- Status: planned
- Goal: verify robustness across resorts and artifacts.
- Changes:
  - validate at least 3 resorts across regions.
  - add integrity checks from catalog -> pack -> basemap assets.
- Test:
  - all selected resorts pass publish + render checks.
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
