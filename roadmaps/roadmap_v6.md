# Roadmap v6

## Scope
- Focus v6 on map usability, terrain readability, and basemap richness while preserving patrol workflow clarity.
- Improve visual differentiation for ski runs and terrain context on mobile-first viewports.
- Add more useful map context from the existing offline vector basemap where available (buildings, restaurants, trees, rivers/lakes).
- Evolve terrain rendering toward an OnX-style readable terrain look using vector-only techniques and offline-compatible data paths.
- Keep the app to two pages:
  - Select Resort
  - Resort Page

## Constraints
- No backend/server work in v6.
- Business logic coverage remains 100% (unit tests).
- Production-grade code only; no placeholder UX/code in shipped behavior.
- Preserve offline-first behavior after app install and resort pack download.
- Terrain rendering enhancements must not materially reduce readability of patrol overlays (runs, lifts, boundary, user position, key labels).
- Aerial mode remains optional/config-gated and online-only unless a later roadmap explicitly changes architecture.
- Roadmap is deliverables-only; detailed UX/UI specs live under `/spec/XD` when needed.

## v6 Non-Functional Requirements
- Clear separation of UI and business logic for new controls/toggles and style selection behavior.
- Rendering choices are configuration-driven (constants/tunable parameters), not hardcoded magic values scattered across layers.
- Map styling changes must maintain smooth pan/zoom behavior on modern phones.
- Offline parity remains mandatory for any feature using local vector data.
- New terrain layers/features must be ordered and styled so patrol overlays remain the highest-utility information.

## Global Definition Of Done
- Code/spec/docs changes merged with required tests.
- Business logic unit test coverage maintained at 100%.
- Manual acceptance checks completed for relevant viewports (`small`, `medium`, `large`) and offline mode where applicable.
- `roadmap_v6.md` slice status updated in this file.
- No debug logs or temporary diagnostics shipped.

## Out of Scope (v6)
- Photorealistic 3D terrain.
- Raster hillshade tiles or bitmap terrain overlays.
- New backend tile services.
- Full replacement of current basemap generation stack.
- Guaranteed support for every POI/landcover subtype in all resorts (coverage depends on source data in vector basemap).

## Architecture Decisions (Locked for v6)
- `Buildings / restaurants / trees / rivers / lakes` are handled as **basemap style layers only** (from vector PMTiles/OpenMapTiles data already in the basemap tile archive).
- `Contours / terrain tint / terrain shading / peaks` are handled as **resort overlay / generated data** (CLI-managed, publishable in resort bundles, offline-safe).
- Terrain enhancements remain **vector-only**.
- Resort overlays remain visually above terrain layers.

## Terrain Style Target (Locked for v6)
- Reference target: OnX-style readable terrain look (attached reference image in planning discussion).
- Implement terrain depth/readability using vector-only methods.
- Required visual characteristics:
  - muted hypsometric tint (green -> tan/beige -> light beige)
  - warm brown semi-transparent contour lines
  - major/minor contour hierarchy
  - major contour labels with elevation
  - subtle faux shading (vector-only), never muddy or high-contrast
- Readability requirements:
  - runs, hazards, user marker, and key labels remain clearly legible
  - terrain layer must not overpower patrol overlays

## Configurability Requirements (v6 Terrain Program)
Expose tunable constants/config (not hardcoded throughout render code) for:
- elevation ramp stops and colors
- contour intervals (minor/major)
- contour opacity/width
- shading intensity (`0..1`)
- contour label density / zoom thresholds
- terrain layer visibility zoom thresholds

## Testing Requirements (v6 Terrain Program)
- Visual regression snapshots (or deterministic style/layer snapshots where image snapshots are too brittle) for:
  - low-elevation valley area
  - steep ridge area
  - dense contour zone near a peak
- Usability checks for readability of:
  - dark runs on light terrain
  - labels over shaded/steep zones
  - GPS marker over terrain shading
- Performance checks:
  - no noticeable lag during standard pan/zoom on target phones

## Slice 1: v6 Spec + Map Style Strategy Gate (No Production Behavior Changes)
- Status: completed
- Goal: lock v6 map styling goals, layer priority rules, and acceptance criteria before implementation.
- Deliverables:
  - document v6 map style goals and visual acceptance criteria (terrain + basemap context)
  - define layer priority order (terrain/basemap vs overlays vs labels)
  - define double-black symbology requirements (dashed behavior, widths, zoom behavior)
  - define POI/building/tree/water naming/readability rules
  - define terrain config surface (tunable constants list)
  - define visual regression strategy for map styling checks
- Rules:
  - no production map rendering changes in this slice
- Test / Acceptance:
  - no unresolved ambiguity on v6 symbology/terrain goals
  - all slice acceptance criteria references are clear enough for incremental PR review
- PR outcome: implementation slices can proceed with stable visual targets and rules.
- Outcome:
  - map style strategy spec added: `/Users/piovese/Documents/Patrol Toolkit/spec/XD/map_style_strategy_spec_v1.md`
  - locked layer priority, basemap-vs-overlay architecture split, double-black dashed symbology direction, terrain vector-only constraints, and v6 terrain testing strategy
  - no production rendering behavior changed in this slice

## Slice 2: Double-Black Run Symbology Differentiation (Dashed)
- Status: completed
- Goal: make double-black runs visually distinct from black runs without reducing readability.
- Deliverables:
  - identify double-black run classification mapping in existing run style logic
  - render double-black runs with dashed line treatment (style similar to reference inspiration)
  - preserve direction arrows for piste line runs only
  - ensure dashed style works with labels and arrows at target zooms
  - keep black runs solid and visually distinct
- Test / Acceptance:
  - double-black and black runs are clearly distinguishable on mobile
  - dashed rendering does not break labels/arrow placement
  - no regressions to green/blue/black styles
- PR outcome: run symbology is improved for patrol readability.
- Outcome:
  - double-black runs already render with dashed line styling in existing run map layer paint (`line-dasharray` by `difficulty === double-black`)
  - black runs remain solid and visually distinct
  - deterministic style/layer tests already cover the dashed behavior (`src/map/run-style.test.ts`, `src/map/run-layers.test.ts`)
  - no additional production code changes required in this slice

## Slice 3: Basemap Layer Availability Audit (Offline Vector Tile Coverage)
- Status: planned
- Goal: determine what context layers already exist in the current basemap vector tiles and style source, before adding UI-visible style layers.
- Deliverables:
  - inspect OpenMapTiles/Planetiler output layers in current generated PMTiles/style path
  - verify availability of data for:
    - buildings
    - restaurants/food POIs
    - trees/woodland/forest landcover
    - rivers/waterways and lake/water labels
  - document layer names + source-layer mappings + relevant properties
  - document coverage limitations by resort/region
- Test / Acceptance:
  - explicit table of available source layers/fields exists
  - clear ship/no-ship decision for each target context feature based on actual tile data
- PR outcome: implementation slices use real available data and avoid guessing.

## Slice 4: Buildings + Trees Basemap Style Layers
- Status: planned
- Goal: add terrain/context richness using existing offline vector basemap layers for buildings and trees/wooded areas.
- Deliverables:
  - add building fill/line styling (low contrast, non-distracting)
  - add tree/woodland/forest styling (muted greens, low contrast)
  - maintain readability of runs/lifts/labels above these layers
  - tune zoom thresholds so clutter is controlled on `small`
- Test / Acceptance:
  - buildings and trees render offline where source data exists
  - overlays remain dominant and readable
  - no clutter regression on phone viewport
- PR outcome: map gains useful terrain context without losing patrol clarity.

## Slice 5: Water Features + River/Lake Labels (Basemap Style)
- Status: completed
- Goal: show rivers, waterways, lakes, and their names using existing basemap vector tile layers.
- Deliverables:
  - style waterways and water bodies for readability on current terrain/basemap background
  - enable river/lake labels (with collision/zoom tuning)
  - preserve contour and run readability when labels overlap dense terrain zones
- Test / Acceptance:
  - river/lake labels appear where source data exists
  - labels remain readable on `small`
  - no major collision clutter in dense map areas
- PR outcome: water context is visible and informative.
  - Outcome (completed):
    - extended generated default offline basemap style to include:
      - `waterway` line layer (muted blue, low-contrast width ramp)
      - `water-name` symbol layer from `water_name` source-layer (`symbol-placement: line`)
      - `waterway-name` symbol layer from `waterway` source-layer (fallback naming path where `water_name` is absent)
  - tuned water fill and labels to stay subordinate to patrol overlays
  - implemented `water_name` as optional basemap label path (graceful fallback when source-layer has no features in visible tiles)
  - added extractor test coverage asserting generated fallback style includes waterway + water labels configuration

## Slice 6: Restaurants + Key Amenity POIs (Basemap Style)
- Status: planned
- Goal: show restaurants/food POIs (and only a minimal amenity subset) without cluttering the map.
- Deliverables:
  - identify and style restaurant/food POIs from basemap layers
  - define minimal POI subset and label/icon rules
  - add zoom thresholds and label density limits for mobile readability
  - keep POIs below patrol-critical overlays and labels in visual priority
- Test / Acceptance:
  - restaurant POIs appear where data exists
  - map remains readable in resort core areas
  - no excessive label clutter on `small`
- PR outcome: useful operational amenities are visible in context.

## Slice 7: Terrain Render Config Foundation (Vector-Only)
- Status: planned
- Goal: create a configuration-driven terrain style foundation before adding full terrain visual effects.
- Deliverables:
  - central terrain style config module/constants (colors, contour widths/opacities, label density, zoom thresholds)
  - contour major/minor classification rules in shared/tested logic
  - terrain layer ordering rules documented/implemented for map render path
  - test harness for terrain style config snapshots
- Test / Acceptance:
  - style config values are centralized and unit tested
  - no terrain style values hardcoded across multiple modules after refactor
- PR outcome: terrain styling becomes tunable and maintainable.

## Slice 8: Contour Hierarchy Refinement + Major Labels (Vector Overlay)
- Status: planned
- Goal: transform current contour rendering into a major/minor contour system with improved labels and lower visual dominance.
- Deliverables:
  - split contour rendering into minor vs major contours (e.g., every Nth line major)
  - warm brown / sepia contour palette aligned to terrain target
  - thinner/lighter minor contours, slightly stronger major contours
  - major contour elevation labels at controlled density and zoom thresholds
  - contour label collision and readability tuning
- Test / Acceptance:
  - major/minor contour hierarchy is visually obvious when zoomed in
  - contour labels are readable and not overly dense
  - contours remain subordinate to ski overlays
- PR outcome: contours become terrain-informative and style-aligned.

## Slice 9: Hypsometric Tint Prototype (Vector-Only Terrain Fill)
- Status: planned
- Goal: add a muted elevation-based background tint that reads as terrain even without other overlays.
- Deliverables:
  - define hypsometric ramp (low green -> mid tan/beige -> high light beige)
  - implement vector-only elevation band fill path using precomputed/generated vector data (resort overlay path)
  - tune opacity/contrast for mobile readability
  - ensure overlay priority remains unchanged
- Test / Acceptance:
  - map reads as terrain at a glance with overlays hidden
  - labels remain readable with standard halos/styling
  - offline rendering works when vector terrain band data is bundled
- PR outcome: vector-only terrain tint foundation is shipped or a concrete blocker is documented.

## Slice 10: Faux Shading Prototype (Vector-Only Depth)
- Status: planned
- Goal: simulate terrain depth using a subtle vector-only technique that preserves readability and performance.
- Deliverables:
  - choose one vector-only shading approach for first implementation (recommended simplest viable path):
    - contour-density shading, or
    - slope/elevation band lightness shifts
  - implement subtle depth layer with tunable intensity
  - avoid visible banding/muddy contrast at target zooms
  - document algorithm and limitations
- Test / Acceptance:
  - terrain appears to have depth (visibly improved from tint-only)
  - runs/labels/user marker remain high-contrast and readable
  - pan/zoom performance remains acceptable on target phones
- PR outcome: terrain depth prototype shipped (or no-ship with concrete technical blocker and evidence).

## Slice 11: Peaks Label System + Elevation Label Readability Polish
- Status: planned
- Goal: improve peak and elevation labeling so they stay legible over terrain layers and contours.
- Deliverables:
  - refine `peak name + elevation` label placement/zoom rules
  - tune contour major label styling (halo, color, opacity) for terrain mode readability
  - reduce collisions between peak labels, contour labels, and run/lift labels
- Test / Acceptance:
  - peak labels remain crisp over terrain shading/tint
  - contour labels remain legible but not dominant
  - no significant label clutter regressions in peak-dense areas
- PR outcome: terrain labels feel intentional and readable.

## Slice 12: Terrain + Overlay Readability QA Pass (Small/Medium/Large)
- Status: planned
- Goal: validate that the enriched basemap + terrain styling remains usable for patrol workflows across viewports.
- Deliverables:
  - manual QA matrix for `small`, `medium`, `large` (portrait/landscape where relevant)
  - readability checks for runs/lifts/boundary/GPS marker over terrain layers
  - compare terrain on/off readability impact (material regressions not allowed)
  - tune style constants based on field test feedback
- Test / Acceptance:
  - no material regression in patrol overlay clarity when terrain is enabled
  - all key layers render correctly online/offline where expected
  - identified issues are either fixed or documented with rationale
- PR outcome: terrain/basemap style is operationally usable.

## Slice 13: Basemap Generation Style Profile Upgrade (Optional, Data-Driven)
- Status: planned
- Goal: improve source basemap style/profile generation if current PMTiles lack required vector data richness for v6 context layers.
- Deliverables:
  - evaluate whether current Planetiler/OpenMapTiles profile includes sufficient features for buildings/POIs/water labels/trees
  - if needed, adjust provider/style generation config (without breaking existing offline basemap workflow)
  - document exact basemap generation implications (size/time/coverage)
- Test / Acceptance:
  - any generation changes are measurable and justified
  - offline basemap generation/publish workflow remains stable
- PR outcome: either no change needed (data already sufficient) or targeted basemap generation improvements documented and implemented.

## Slice 14: v6 Closeout (Spec-to-Code Audit, Performance, Docs)
- Status: planned
- Goal: finish v6 with a focused style/readability/performance audit and documentation closure.
- Deliverables:
  - audit v6 implementation against locked style requirements and acceptance criteria
  - finalize terrain tuning constants/config defaults
  - summarize what shipped vs deferred (especially faux shading / hypsometric depth quality gaps)
  - update README/docs for new map capabilities (double-black dashed, terrain styling, basemap context layers)
  - record any follow-up technical debt/quality items for v7
- Test / Acceptance:
  - `npm run check` passes
  - targeted visual/interaction checks pass on representative resorts
  - roadmap statuses updated to completed
- PR outcome: v6 map usability and terrain program is complete and documented.

## Open Decisions (Track During v6)
- Exact vector-only faux shading approach to ship first (`contour-density` vs `band-lightness`), based on quality/performance evidence.
- Whether current basemap tile data is sufficient for all desired context layers without generation profile changes.
