# Roadmap v3

## Scope
- Deliver install/distribution flow using GitHub/GitHub Pages only (no backend server).
- Deliver reliable app update flow from phone devices, pulling the latest approved GitHub-hosted build.
- Prepare first production release process and artifacts.
- Keep current vector basemap as default for first release.
- Improve map readability with:
  - downhill direction arrows on runs
  - lift names + tower numbers on map
  - ridges/bowls/perimeter areas rendered similarly to boundary-style overlays

## Constraints
- Offline-first remains mandatory after initial install + pack download.
- Resort packs remain the source of truth for terrain data.
- Business logic requires full unit test coverage.
- Changes land as small, testable PR slices.
- Roadmap is milestone-based; no date commitments in v3 plan.

## Global Definition Of Done
- Code merged with required tests.
- Business logic coverage maintained at 100%.
- Manual checks for slice acceptance completed.
- Docs/runbook updated for user/maintainer impact.
- Roadmap slice status updated in this file.

## Out of Scope (v3)
- Backend/server infrastructure outside GitHub/GitHub Pages.
- Automatic/forced app updates on user devices.
- Automatic pack updates without explicit user action.
- Manual non-OSM source-of-truth datasets for ridges/bowls/perimeter areas.

## Operational Flows (v3 Target)
### User Flow: Access, Install, Use, Update
1. Open stable production URL on GitHub Pages.
2. Install PWA from top-right Settings/Help panel.
3. Open installed app and download selected resort pack(s).
4. Use app online/offline after warm cache.
5. Manually run `Check for updates` for app updates.
6. Manually run `Check pack updates`, select resorts, apply updates.
7. Review update result summary (success/failure per selected resort).

### Maintainer Flow: Roll Out App + Resort Pack Updates
1. Merge validated slice PRs.
2. Run quality gates (`npm run check`, extractor `check`).
3. Confirm resort scope: `ready + validated + published`.
4. Build release artifacts (app build + catalog + packs) with checksums.
5. Run release dry-run and integrity audit.
6. Tag release and publish GitHub Release artifacts.
7. Promote release to stable GitHub Pages production URL.
8. Run post-deploy smoke checks (online/offline/install/update).
9. Roll back to previous release artifacts if smoke checks fail.

## Slice 1: PWA + GitHub Distribution Architecture
- Status: completed
- Goal: define and lock how app + resort packs are distributed from GitHub/GitHub Pages.
- Changes:
  - define canonical hosting model:
    - app shell from a single stable GitHub Pages production URL
    - resort catalog/index and packs from repo/GitHub Pages artifacts
    - production publish is release-gated (no direct `main` auto-publish to production URL)
  - define versioning contract for app build and resort packs.
  - define compatibility contract so packs declare supported app versions (for example `minAppVersion` / `maxAppVersion`).
  - define immutable release manifest format with checksum fields for app and pack artifacts.
  - define cache/update policy (when app updates, when packs update, rollback behavior).
  - document required repository structure and publish paths.
- Test:
  - [x] architecture checklist reviewed and approved.
  - [x] no unresolved decision points for release pipeline.
- PR outcome: distribution contract locked.

## Compatibility Matrix (Define in Slice 1, Enforce in Slice 2+)
- App version -> supported pack schema versions.
- Pack version -> `minAppVersion` and optional `maxAppVersion`.
- Update UI must block any app/pack pair outside compatibility contract.

## Slice 2: Install + Download UX for Devices
- Status: completed
- Goal: make clean-device installation and pack download operational using only GitHub-hosted assets.
- Changes:
  - add in-app "install app" guidance flow (browser/PWA prompts + fallback instructions).
  - add in-app resort pack download flow from GitHub-hosted catalog.
  - add in-app manual `Check pack updates` button so users decide when pack updates are applied.
  - add in-app "Check for updates" button for phone users, with manual user-triggered app update/reload flow.
  - place update/install actions in a top-right Settings/Help panel (not in the primary operations panel).
  - show update details before apply: target version + short changelog summary.
  - block incompatible pack updates in UI with explicit compatibility messaging.
  - keep app and pack update checks independent, guarded by compatibility constraints.
  - when multiple pack updates are available, require user selection of specific resorts (no default update-all).
  - apply selected pack updates independently per resort; continue on individual failures and report partial success/failure summary.
  - verify artifact checksum before applying app or pack update.
  - make updates transactional: failed update does not replace current working app/pack.
  - preserve current active resort selection across app update/reload.
  - add pack storage management UX (size shown before download/update and remove old pack versions).
  - add explicit state indicators: installed, update available, offline ready.
  - document clean-device walkthrough for iOS/Android/Desktop.
  - standardize user-facing error/result codes/messages for update flows.
- Test:
  - manual clean-device walkthrough succeeds from docs only.
  - app installs and loads; selected resort pack downloads and becomes active.
  - phone app update walkthrough succeeds (manual button fetches latest approved GitHub-hosted app build).
  - resort pack update walkthrough succeeds (manual button detects and applies a new pack version).
  - checksum mismatch blocks update with clear error.
  - interrupted/failed update preserves last working app/pack.
  - offline reload works after warm cache.
- PR outcome: device onboarding works end-to-end.

### Storage Budget Targets (Define in Slice 2)
- Define max offline app cache budget.
- Define per-resort pack size budget target and warning thresholds.
- Define behavior on low-storage devices (block, retry, cleanup guidance).

## Slice 3: First Release Pipeline (v1.0.0)
- Status: in_progress
- Goal: ship first formal release with repeatable process.
- Changes:
  - add release checklist and versioning policy (tagging, changelog, evidence bundle).
  - define GitHub release artifact set (build output + catalog + selected packs).
  - add integrity checks in CI/local script for published assets.
  - add rollback/recovery steps for bad publish.
  - set release scope to all resorts that are `ready + validated + published` at release time.
  - add release promotion step that deploys only signed-off release artifacts to stable production URL.
  - add post-deploy smoke-check script/checklist and explicit rollback trigger criteria.
- Test:
  - dry-run release from a test tag succeeds.
  - artifact integrity checks pass.
  - release candidate gate confirms each included resort is `ready + validated + published`.
  - install path from release artifacts is verified on clean machine.
  - post-deploy smoke checks pass on stable production URL.
- PR outcome: release process is operational and auditable.

### Release Go/No-Go Gate (Slice 3)
- All included resorts are `ready + validated + published`.
- App/pack compatibility matrix passes for release set.
- Artifact checksums/manifests verified.
- Clean-device install + offline smoke checks pass.
- Rollback artifact/path validated before go-live.

## Slice 4: Run Direction Arrows (Downhill)
- Status: planned
- Goal: add clear downhill direction indicators on runs, inspired by openskimap patterns.
- Changes:
  - compute deterministic arrow direction per run segment from geometry/elevation semantics.
  - add map style layers for directional arrow symbols aligned to run lines.
  - use neutral/dark run arrows with light halo (arrows are not difficulty-colored).
  - tune density/zoom thresholds to avoid clutter (`minArrowZoom=13` default).
  - maintain difficulty color readability with arrows enabled.
  - enforce difficulty cartography conventions, including double-black rendered as black dashed.
- Test:
  - unit tests for direction calculation and tie-break behavior.
  - visual checks at low/high zoom in dense run areas.
  - offline parity check confirms identical arrow rendering.
- PR outcome: runs show clear travel direction without clutter.

## Slice 5: Lift Labels + Tower Number Display
- Status: planned
- Goal: show lift names and tower numbers in a readable, operational way.
- Changes:
  - render lifts as thicker colored corridors/lines, visually distinct from runs.
  - add lift name labeling along lift direction (angled), with halo, plus zoom/collision rules.
  - add tower number symbols/labels with scale-dependent visibility (`minTowerZoom=15`, always shown when above threshold; no toggle required).
  - keep lift arrows disabled (no repeated direction arrows on lifts).
  - enforce style hierarchy so runs/lifts/labels remain legible together.
- Test:
  - unit tests for label/tower formatting logic.
  - visual validation in dense lift zones.
  - offline parity check for all lift/tower labels.
- PR outcome: lift context is immediately visible on map.

## Slice 6: Ridges/Bowls/Perimeter Areas Overlay
- Status: planned
- Goal: represent named mountain areas (ridges, bowls, etc.) as perimeter overlays similar to boundaries.
- Changes:
  - define schema additions for named area perimeters in resort packs.
  - add CLI support to auto-fetch/store/validate area perimeter geometries from OSM tags when available.
  - define "good geometry" acceptance rules for area import:
    - valid polygon/multipolygon geometry
    - non-self-intersecting rings
    - minimum/maximum area sanity bounds
    - intersects or is near resort boundary envelope
    - has usable name tag
  - keep OSM as source of truth (no local manual override dataset).
  - render perimeter overlays with distinct style from resort boundary.
  - add labels and optional visibility thresholds by zoom.
- Test:
  - schema + validator tests for area geometries and names.
  - CLI integration tests for ingest/update/publish.
  - app visual checks for readability online/offline.
  - when no good OSM area data exists, UI remains silent and shows no area overlay.
- PR outcome: operational mountain sub-areas are mapped and usable.

## Slice 7: v3 Exit Signoff
- Status: planned
- Goal: close v3 with production-quality evidence and release readiness.
- Changes:
  - update runbooks (install, updates, troubleshooting, rollback).
  - capture evidence bundle (screenshots, timing, integrity reports, offline checks).
  - finalize roadmap statuses and release notes.
- Test:
  - `npm run check` and extractor checks pass.
  - final acceptance checklist fully complete.
  - clean-device signoff repeated for at least one iOS/Android/Desktop path.
- PR outcome: v3 closure complete and ready for release execution.

## Open Decisions (Track Early)

## Standard Update/Error Messages (Define in Slice 2)
- `UPDATE_INCOMPATIBLE_VERSION`: selected update is not compatible with installed app.
- `UPDATE_CHECKSUM_FAILED`: downloaded artifact integrity check failed.
- `UPDATE_PARTIAL_SUCCESS`: some selected resorts updated, some failed.
- `UPDATE_ROLLBACK_APPLIED`: previous working version restored after failure.
- `OFFLINE_SOURCE_UNAVAILABLE`: network/source not reachable for update check.
