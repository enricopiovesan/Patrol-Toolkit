# v2 Exit Acceptance Checklist - 2026-02-21

## Code and Tests
- [x] `npm run check` passes on current branch.
- [x] No failing extractor tests (`npm --prefix tools/osm-extractor run check`).
- [x] Slice roadmap statuses are updated.

## CLI Workflow
- [x] Create/select resort in menu.
- [x] Boundary, runs, lifts sync workflow validated.
- [x] Manual validations gate publishing correctly.
- [x] Option 9 generate/publish succeeds for a ready resort.
- [x] `Unpublish resort` removes only app-published artifacts.

## App Workflow
- [x] Resort switch updates overlays and basemap correctly.
- [x] Runs render as lines with difficulty colors.
- [x] Run labels are readable at intended zooms.
- [x] Phrase output includes objective anchor distance.

## Offline Workflow
- [x] App shell loads offline after warm cache.
- [x] Offline basemap and overlays render.
- [x] Phrase generation works offline.

## Evidence
- [x] Evidence bundle completed (`docs/evidence/v2-exit-evidence-2026-02-21.md`).
- [x] Screenshots attached for online/offline map and phrase examples.
