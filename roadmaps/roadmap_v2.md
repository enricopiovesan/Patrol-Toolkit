# Roadmap v2

## Scope
- Build on v1 completion and focus on reliability, scale, and operator throughput.
- Keep offline-first behavior as a hard requirement.

## Slice 1: Basemap Freshness + Rebuild Controls
- Status: planned
- Goal: make rebuild intent explicit and safe.
- Changes:
  - add menu option to force basemap rebuild for current version.
  - add dry-run preview of rebuild inputs (extract, bbox, zoom, provider command).
- Test:
  - force rebuild actually regenerates artifacts.
  - dry-run prints deterministic plan with no writes.
- PR outcome: predictable regeneration workflow.

## Slice 2: Multi-Resort Validation Harness
- Status: planned
- Goal: verify the pipeline beyond one resort.
- Changes:
  - add scripted validation for at least 3 resorts across different countries/regions.
  - persist per-resort validation report in `roadmaps/validation_reports/`.
- Test:
  - all selected resorts pass generated/published artifact checks.
- PR outcome: broader confidence envelope.

## Slice 3: Offline Runtime Diagnostics
- Status: planned
- Goal: reduce debugging time when offline map fails.
- Changes:
  - add non-invasive debug panel (or logs) for style URL, pmtiles URL, SW/cache status.
  - expose one-click copy of diagnostics payload.
- Test:
  - diagnostics present accurate asset and cache state in online/offline modes.
- PR outcome: faster root-cause analysis.

## Slice 4: Service Worker Cache Lifecycle Hardening
- Status: planned
- Goal: prevent stale cache edge cases during updates.
- Changes:
  - formalize cache migration/version policy.
  - add integration tests for upgrade path and stale cache eviction.
- Test:
  - update from previous SW version keeps app functional offline.
- PR outcome: robust update behavior.

## Slice 5: Provider Performance + Progress UX
- Status: planned
- Goal: improve long-running option `9` experience.
- Changes:
  - add structured progress phases and elapsed time summaries.
  - cache warm/cold preflight indicator before generation starts.
- Test:
  - logs always show phase transitions and final timing breakdown.
- PR outcome: better operator predictability.

## Slice 6: Pack Integrity Verification
- Status: planned
- Goal: guarantee publish artifacts are self-consistent.
- Changes:
  - add pack integrity command to validate catalog entry -> pack file -> basemap assets.
  - optional checksum manifest for `public/packs/<resortKey>/`.
- Test:
  - command detects missing/invalid/mismatched artifacts.
- PR outcome: release gate for publish integrity.

## Slice 7: Documentation and Runbook v2
- Status: planned
- Goal: keep docs aligned with operational reality.
- Changes:
  - add advanced troubleshooting matrix (symptom -> cause -> fix).
  - add upgrade runbook for moving from v1 to v2 process.
- Test:
  - doc-only operator execution on clean machine.
- PR outcome: low-friction onboarding and maintenance.

## Slice 8: v2 Exit Validation + Signoff
- Status: planned
- Goal: formal completion of v2.
- Changes:
  - run end-to-end validation checklist for selected resorts.
  - capture timings, artifact sizes, and offline rendering outcomes.
- Test:
  - all exit criteria pass with evidence attached.
- PR outcome: v2 closure with auditable evidence.
