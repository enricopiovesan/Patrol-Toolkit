# v2 Exit Acceptance Checklist

## Code and Tests
- [ ] `npm run check` passes on current branch.
- [ ] No failing extractor tests (`npm --prefix tools/osm-extractor run check`).
- [ ] Slice roadmap statuses are updated.

## CLI Workflow
- [ ] Create/select resort in menu.
- [ ] Boundary, runs, lifts sync workflow validated.
- [ ] Manual validations gate publishing correctly.
- [ ] Option 9 generate/publish succeeds for a ready resort.
- [ ] `Unpublish resort` removes only app-published artifacts.

## App Workflow
- [ ] Resort switch updates overlays and basemap correctly.
- [ ] Runs render as lines with difficulty colors.
- [ ] Run labels are readable at intended zooms.
- [ ] Phrase output includes objective anchor distance.

## Offline Workflow
- [ ] App shell loads offline after warm cache.
- [ ] Offline basemap and overlays render.
- [ ] Phrase generation works offline.

## Evidence
- [ ] Evidence bundle completed (`docs/evidence/v2-exit-evidence-template.md`).
- [ ] Screenshots attached for online/offline map and phrase examples.
