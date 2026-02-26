# v5 Aerial View Feasibility (Free / Online / Offline Constraints)

## Outcome

- **v5 shipped:** config-gated **online-only aerial-view prototype** in the Resort Page (MapTiler Satellite).
- **Provider path:** `MapTiler` raster tiles behind env config (`VITE_AERIAL_PROVIDER`, `VITE_MAPTILER_KEY`).
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

## Implemented prototype path (v5 Slice 12)

Implemented path:

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

4. Attribution
   - attribution is provided through the raster source style metadata and MapLibre attribution control

5. Keep aerial mode out of offline pack generation in v5
   - no aerial imagery in resort bundles

## UX behavior (implemented)

- Aerial mode must be clearly marked as **online only**
- If user is offline, aerial toggle is disabled and switching offline while aerial is active auto-falls back to standard mode with a toast
- Toggle should never break the current vector/offline map mode

## v5 ship / no-ship summary

- **Ship in v5:** config-gated user-facing aerial toggle prototype (online-only), documented constraints
- **Do not ship in v5:** offline aerial packaging in resort bundles

## Local configuration (prototype)

Set env vars before running the app:

- `VITE_AERIAL_PROVIDER=maptiler`
- `VITE_MAPTILER_KEY=<your_maptiler_key>`

If config is missing/invalid, the aerial toggle is hidden and the app continues using the existing vector/offline basemap path.
