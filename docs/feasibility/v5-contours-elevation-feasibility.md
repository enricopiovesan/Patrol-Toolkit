# v5 Contours / Elevation Feasibility (Free / Online / Offline Constraints)

## Outcome

- **v5 decision:** no shipped contour/elevation overlay in `v5`.
- **Prototype path:** feasible later as an optional overlay if a data source is selected and packaged cleanly.
- **Offline contour/elevation support:** **no-ship in v5** pending data-source selection, licensing validation, and bundling/performance validation.

## Scope and constraints

Project constraints for this decision:

- free or free-tier usage preferred
- compatible with current PWA + MapLibre app architecture
- compatible with GitHub-hosted app delivery
- no new server required for v5
- offline support is a project priority
- overlays must not degrade usability on `small` viewport

## What is being evaluated

There are two different capabilities in this request:

1. **Contour line visualization** (map overlay)
2. **Elevation values / hill information** (data and labeling behavior)

They are related, but the implementation and data requirements are different.

## Feasibility summary

### 1) Contour lines (visual overlay)

Feasible in principle, but not ready to ship in v5.

What makes it feasible:

- MapLibre can render line overlays efficiently if tiles or vectors are available
- contour styling can be layered under resort overlays
- UI fit is straightforward (toggle or style variant) once data is solved

What blocks v5 shipping:

- no selected free data source + packaging workflow validated for this project
- no v5 verification of offline bundle size impact across multiple resorts
- no legibility/performance tuning completed for `small` viewport

### 2) Elevation values / labels

Not feasible to ship in v5 within current scope.

Reasons:

- requires a reliable elevation source and integration strategy (DEM/derived data)
- increases rendering/data complexity beyond v5 usability-fix scope
- no agreed UI spec for elevation labels/interaction in v5

## Online vs offline feasibility

### Online-only contour overlay

Potentially feasible as a later prototype, but not selected for v5.

Tradeoffs:

- provider/data source selection still required
- licensing/attribution review still required
- behavior differs from offline mode unless contour data is also bundled

### Offline contour overlay (preferred long-term path)

Potentially feasible, but not in v5.

What would be needed:

- a contour data source with redistribution rights compatible with resort-pack delivery
- a preprocessing workflow to clip/simplify to resort bounds
- bundle size/performance validation on phone devices
- styling/labeling tuning for readability over the current basemap and overlays

## Why v5 does not ship contours/elevation

v5 is a usability + bug-fix roadmap. Shipping contours/elevation responsibly would require:

- data-source selection
- licensing review
- packaging workflow implementation
- rendering performance testing
- UI/legibility tuning

That is a separate workstream and would put v5 scope and stability at risk.

## Recommended path (post-v5)

1. Select a contour/elevation data source and validate licensing/redistribution.
2. Build a small proof-of-concept for one resort:
   - clipped contour overlay
   - offline bundle size measurement
   - phone performance check
3. Define UI spec for contour/elevation visualization:
   - default on/off behavior
   - label density
   - visibility at zoom levels
4. Ship only after readability and offline performance are validated.

## v5 ship / no-ship summary

- **Ship in v5:** documented feasibility outcome and implementation path guidance
- **Do not ship in v5:** contour overlay feature, elevation labels/data UI
