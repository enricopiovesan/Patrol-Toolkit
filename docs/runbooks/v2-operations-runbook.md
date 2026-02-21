# v2 Operations Runbook

## Purpose
Operate Patrol Toolkit v2 reliably for resort publishing and app verification with offline-first guarantees.

## Preconditions
- `npm run check` passes.
- Resort boundary, runs, lifts are synced and complete.
- Resort manual validation is complete (boundary/runs/lifts all yes).
- Basemap provider configuration is valid (`tools/osm-extractor/config/basemap-provider.json`).

## CLI Publish Flow (per resort)
1. Run extractor menu:
   - `npm --prefix tools/osm-extractor run run:menu`
2. `Resort list` -> select resort.
3. Validate all three layers:
   - `6 Validate boundary`
   - `7 Validate runs`
   - `8 Validate lifts`
4. Generate and publish basemap assets:
   - `9 Generate basemap assets`
   - mode `1 Generate/publish`.
5. Confirm metrics:
   - `Generated: yes`
   - `Published: yes`
   - readiness is `ready`.

## App Verification (online + offline)
1. Build and preview app:
   - `npm run build && npm run preview`
2. Open app online once and select target resort.
3. Verify map behavior online:
   - basemap tiles visible,
   - runs rendered as lines with difficulty colors,
   - run labels readable,
   - phrase generation returns objective distance anchors.
4. Switch DevTools network to `Offline` and reload.
5. Verify offline:
   - app shell loads,
   - selected resort loads,
   - basemap + overlays render,
   - phrase generation still works.

## Publish Safety Gates
A resort can be published only when:
- manual validation is true,
- readiness overall is `ready`.

If readiness is incomplete (for example lifts=0), publish must fail.

## Rollback
To remove a bad published resort from app catalog without deleting resort data:
- Resort menu -> `13 Unpublish resort`.

To remove resort data and all published assets:
- Resort menu -> `12 Delete resort`.
