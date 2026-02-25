# v5 Aerial View Feasibility (Free / Online / Offline Constraints)

## Outcome

- **v5 decision:** no shipped aerial-view toggle in `v5`.
- **Prototype path:** feasible for **online-only** use behind config (recommended provider: MapTiler Satellite).
- **Offline aerial basemap:** **no-ship in v5** due licensing/redistribution/packaging constraints and data volume.

## Scope and constraints

Project constraints for this decision:

- free or free-tier usage preferred
- compatible with current PWA + MapLibre app architecture
- compatible with GitHub-hosted app delivery
- no new server required for v5
- offline support is a project priority, but not at the expense of licensing risk

## Evaluated options (high level)

### 1) MapTiler Satellite (recommended prototype path)

Why it fits:

- MapLibre-compatible raster tiles
- straightforward online integration via raster source/layer
- API key + attribution model is standard and manageable
- good path for a low-risk prototype behind config

Tradeoffs:

- online only for the cloud API path
- API key required
- free tier limits / usage quotas apply
- must verify and keep current attribution + pricing terms before shipping

### 2) Esri World Imagery (not selected for v5 prototype)

Why not selected:

- licensing and offline/export constraints are not as clean for this project model
- not a good fit for a simple GitHub-hosted, offline-first deliverable

### 3) Google satellite tiles (not selected)

Why not selected:

- billing/key/session model is not aligned with project constraints
- caching/storage restrictions are not a good fit for offline/PWA expectations

### 4) Public/government imagery sources (e.g. national datasets)

Why not selected for v5:

- not a simple drop-in global tile solution
- more data-processing/tiling infrastructure than v5 feasibility scope allows
- coverage and workflow complexity are too high for a quick prototype

## Offline aerial feasibility (v5)

### Decision: no offline aerial in v5

Reasons:

- imagery licensing/redistribution risk (especially for bundling resort packs)
- storage size growth would be large compared with current vector basemap packs
- no-server local build workflow becomes substantially heavier
- verification burden for attribution/terms would exceed v5 scope

## Recommended prototype integration path (future slice / post-v5)

If aerial view is prototyped later, use this path:

1. Add config-gated aerial provider settings (environment variables)
   - example:
   - `VITE_AERIAL_PROVIDER=maptiler`
   - `VITE_MAPTILER_KEY=<key>`

2. Add an optional third map control in the Resort Page
   - only shown when aerial provider config is valid
   - hidden otherwise

3. Implement online-only raster aerial basemap variant in `map-view`
   - keep resort overlays (boundary/runs/lifts/labels) unchanged
   - preserve existing offline fallback behavior when offline

4. Add explicit attribution in UI when aerial mode is active

5. Keep aerial mode out of offline pack generation in v5
   - no aerial imagery in resort bundles

## UX guidance for future prototype

- Aerial mode must be clearly marked as **online only**
- If user is offline, hide/disable aerial toggle and show a toast
- Toggle should never break the current vector/offline map mode

## v5 ship / no-ship summary

- **Ship in v5:** documented feasibility outcome + prototype integration path
- **Do not ship in v5:** user-facing aerial toggle, offline aerial packaging

