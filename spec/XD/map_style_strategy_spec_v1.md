# Map Style Strategy Spec v1 (v6)

## Scope
- Defines the v6 map styling strategy and acceptance criteria before implementation begins.
- Covers map layer priorities, run symbology changes, basemap context layer goals, and terrain styling requirements.
- Covers all viewports (`small`, `medium`, `large`) with a mobile-first readability priority.
- This is a v6 Slice 1 deliverable and must be approved before production map style changes begin.

## Source References
- `/Users/piovese/Documents/Patrol Toolkit/roadmaps/roadmap_v6.md`
- Attached planning reference image (OnX Backcountry terrain look target) from roadmap v6 brainstorming thread
- Existing rendering implementation under `/Users/piovese/Documents/Patrol Toolkit/src/map/`

## Goals (Locked)
- Improve terrain readability and map context without reducing patrol overlay clarity.
- Make double-black runs visually distinct from black runs.
- Add useful map context from the offline vector basemap where available:
  - buildings
  - restaurants / food POIs
  - trees / wooded areas
  - rivers / waterways and lake names
- Evolve contour and terrain styling toward an OnX-style readable terrain look using vector-only methods.

## Non-Goals (Locked)
- Photorealistic terrain rendering.
- Raster hillshade / bitmap terrain overlays.
- 3D terrain rendering.
- Server-side terrain rendering services.
- New CLI fetch/update flow for buildings/restaurants/trees/water (these are basemap-style responsibilities in v6).

## Architecture Split (Locked)
### Basemap Style Layers (vector tiles / PMTiles)
Handled via basemap style/source-layer styling only:
- buildings
- restaurants / food POIs
- trees / woodland / forest landcover
- rivers / waterways
- lakes / water labels

### Resort Overlay / Generated Layers (CLI-managed)
Handled as resort-pack overlay/generated data:
- contours
- hypsometric terrain bands (if implemented)
- faux shading support geometry (if implemented)
- peaks

## Layer Priority Order (Locked)
Highest utility information must remain visually dominant.

1. GPS / patrol live state overlays
   - user position marker
   - GPS accuracy ring
   - critical patrol markers (future)
2. Patrol operational overlays
   - runs
   - lifts
   - lift towers
   - resort boundary
   - future hazard overlays
3. Patrol / ski labels
   - run labels
   - lift labels / tower labels
   - peaks labels (name + elevation)
4. Terrain labels
   - contour major labels
   - river/lake names
   - minimal POI names (restaurants) where enabled
5. Terrain linework and context fills
   - contours (minor + major)
   - waterways
   - buildings / trees / landcover
   - hypsometric tint / faux shading
6. Basemap background base

## Run Symbology Requirements (v6)
### Existing Classes (Preserve)
- green
- blue
- black
- double-black

### Double-Black Differentiation (New)
- Double-black runs must be visually distinct from black runs at all useful patrol zoom levels.
- Preferred treatment: dashed line stroke (user-approved direction).
- Black runs remain solid.

### Acceptance Criteria
- Black and double-black are distinguishable at a glance on `small` viewport.
- Dashed double-black styling does not break:
  - line continuity perception
  - direction arrows (for piste line runs only)
  - run labels
- Color + dash treatment remains readable over terrain and contour layers.

## Basemap Context Layer Requirements (v6)
### Buildings
- Low-contrast fill/outline styling.
- Must not compete with run/lift overlays.
- Visibility should be zoom-gated to avoid clutter.

### Restaurants / Food POIs
- Minimal subset only (restaurant/food-related amenities).
- Label density must be tightly controlled on `small`.
- POI labels/icons must sit below patrol overlays in visual priority.

### Trees / Woodland / Forest
- Render as muted, natural green context areas.
- Contrast should remain low enough to preserve run line clarity.
- No heavy texture fills in v6 (vector-only, lightweight styling).

### Rivers / Waterways / Lakes
- Water features visible and readable over terrain background.
- River/lake labels enabled where source data exists and collision rules allow.
- Labels must not materially interfere with run labels or contour labels.

### Acceptance Criteria (Context Layers)
- Features render offline where source tile data exists.
- Missing source data does not break rendering (feature simply absent).
- Patrol overlays remain the most legible information on the map.

## Terrain Style Requirements (Vector-Only, Locked for v6 Program)
### Reference Style Target
- Match the readability and visual intent of the OnX-style reference image:
  - beige/tan terrain feel
  - thin warm-brown contours
  - subtle depth impression
  - clean labels
- Exact visual parity is not required; readability parity is the target.

### Base Terrain Fill (Hypsometric Tint)
- Elevation-based color ramp as primary terrain background fill.
- Muted palette:
  - low elevation: subtle green tint
  - mid elevation: light tan / beige
  - high elevation: very light beige
- Fill must remain low-contrast to preserve readability.

### Contour Lines
- Warm brown / sepia tone.
- Thin, semi-transparent.
- Two-level hierarchy:
  - minor contours: lighter/thinner
  - major contours: slightly thicker/more visible
- Major contours display elevation labels at controlled intervals.

### Faux Shading (Vector-Only Depth)
- Raster hillshade is not allowed.
- First implementation should choose the simplest viable vector-only approach:
  - contour-density shading (preferred first prototype), or
  - elevation-band lightness stepping (slope-band approximation)
- Shading must remain subtle and never muddy.
- If visible banding appears, reduce intensity first before adding complexity.

### Terrain Readability Acceptance Criteria
- Terrain reads as terrain at a glance when overlays are hidden.
- Runs/lifts/GPS marker/key labels remain clearly readable with terrain enabled.
- Contours support terrain understanding without overpowering overlays.

## Label Readability Rules (Locked)
### Overlay Labels (Runs/Lifts/Peaks)
- Must remain readable without heavy halo inflation.
- Peak labels should use `Peak Name + Elevation` when data exists.
- Collision tuning should prefer patrol/ski overlays over terrain/context labels.

### Terrain Labels
- Major contour labels follow line direction where possible.
- River/lake/POI labels are density-limited and zoom-gated.
- Excessive collisions are resolved by hiding lower-priority labels, not by increasing clutter.

## Performance Requirements (Locked)
- Terrain and context styling must support smooth panning/zooming on modern phones.
- Avoid expensive per-frame computations.
- Prefer precomputed/generated vector data for terrain enhancements over runtime geometry derivation.
- Any terrain shading technique must be benchmarked for interaction smoothness on `small` viewport.

## Configuration Surface (v6 Terrain Program)
These values must be centralized/tunable (not scattered constants):
- elevation ramp stops/colors
- contour minor interval
- contour major interval
- contour line widths (minor/major)
- contour line opacities (minor/major)
- contour label zoom thresholds + density
- terrain tint opacity
- shading intensity (`0..1`)
- terrain/context layer zoom thresholds

## Visual Regression & QA Strategy (Locked)
### Test Scenes (Required)
- low-elevation valley area
- steep ridge area
- dense contour zone near a peak

### Verification Modes
- Deterministic style/layer snapshot tests for business/style logic modules.
- Visual/manual regression checks for rendered map readability on target resorts.

### Readability Checks (Required)
Verify readability of:
- dark run lines on light terrain
- labels over shaded/steep terrain zones
- GPS marker over terrain tint/shading

## Slice Sequencing Contract (v6)
- Slice 2 starts with double-black run differentiation (fast visual win).
- Basemap context layers only proceed after a basemap data availability audit confirms source layers/properties.
- Terrain visual enhancements proceed in this order:
  1. config foundation
  2. contour hierarchy refinement
  3. hypsometric tint prototype
  4. faux shading prototype
  5. readability/performance polish

## Approval Checklist (Slice 1)
- [ ] Layer priority order approved
- [ ] Double-black dashed direction approved
- [ ] Basemap vs overlay architecture split approved
- [ ] Terrain style target and vector-only constraints approved
- [ ] Config surface list approved
- [ ] Visual regression/readability strategy approved
- [ ] Slice sequencing accepted
