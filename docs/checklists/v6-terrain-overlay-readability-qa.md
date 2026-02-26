# v6 Terrain + Overlay Readability QA Matrix

## Purpose

Validate that v6 terrain styling (hypsometric tint + faux shading + contour hierarchy + peak labels) improves terrain readability without materially reducing patrol overlay clarity.

This checklist is the execution artifact for `roadmap_v6.md` Slice 12.

## Scope (What Must Be Validated)

- Viewports:
  - `small` phone portrait
  - `small` phone landscape
  - `medium` tablet portrait
  - `medium` tablet landscape (same layout family as large)
  - `large` desktop
- Data modes:
  - online
  - offline (after warm cache)
- Resort coverage:
  - at least one terrain-rich resort with contours + terrain bands (`CA_Golden_Kicking_Horse` `v16+`)
  - one additional published resort for regression sanity (recommended: Fernie)

## Preconditions

1. App build includes v6 Slice 11 (`peak + contour label polish`) and Slice 10 (`faux shading prototype`).
2. Resort pack under test includes:
   - `contours`
   - `terrainBands`
3. Offline cache warmed for the resort(s) under test.
4. For terrain on/off readability comparison:
   - preferred method: compare same viewport/area using a pack/version without terrain bands (pre-v16 Kicking Horse) vs with terrain bands (v16+), or
   - compare screenshots from current branch with a known pre-Slice9 screenshot at equivalent zoom/location.

## Test Matrix

Use the same map area when possible (ridge + runs + lifts + contours + at least one peak label).

### A. `small` phone portrait

- [ ] App loads and terrain renders (no map rendering error toasts).
- [ ] Runs/lifts remain visually dominant over terrain tint/shading.
- [ ] GPS marker remains clearly visible over terrain tint + contours + faux shading.
- [ ] Boundary line remains visible over terrain background.
- [ ] Peak labels remain readable and do not heavily collide with run/lift labels.
- [ ] Contour labels are readable but not dominant.
- [ ] At high zoom, minor contour labels appear and are still reasonably sparse.
- [ ] Panning/zooming remains smooth (no noticeable lag in normal use).

### B. `small` phone landscape

- [ ] Same readability checks as section A.
- [ ] Bottom sheet / controls do not obscure critical map labels more than expected.
- [ ] Terrain shading still reads as depth cue despite reduced vertical space.

### C. `medium` tablet portrait

- [ ] Layout behaves as expected for medium portrait.
- [ ] Terrain layers remain readable without increasing clutter.
- [ ] Peak and contour label collisions are not worse than phone portrait.
- [ ] Overlays remain clearly prioritized.

### D. `medium` tablet landscape (iPad-like landscape)

- [ ] Header + left tools panel + map layout is correct.
- [ ] Terrain readability improves situational awareness without reducing overlay clarity.
- [ ] Peak labels and contour labels remain readable in wider viewport.
- [ ] No missing map controls / no layout regressions while terrain is enabled.

### E. `large` desktop

- [ ] Same layout family as medium landscape (sidebar + map) behaves correctly.
- [ ] Terrain + overlays remain readable when zoomed out and when zoomed in.
- [ ] No material label clutter regression compared to pre-v6 terrain styling.

## Online / Offline Parity

Run on at least one resort with contours + terrain bands.

### Online

- [ ] Contours render
- [ ] Terrain tint renders
- [ ] Faux shading renders
- [ ] Peaks render with label rules
- [ ] Buildings/trees/water/POI context still render (where data exists)

### Offline (after warm cache)

- [ ] App shell loads
- [ ] Same resort pack loads
- [ ] Contours render
- [ ] Terrain tint renders
- [ ] Faux shading renders
- [ ] Peak labels render
- [ ] No blocking local pack fetch failures

## Terrain On/Off Readability Comparison (Material Regression Check)

Use equivalent viewport/zoom/area.

- [ ] Runs are equally or more readable with terrain enabled
- [ ] Lift lines/tower markers remain clearly readable with terrain enabled
- [ ] GPS marker clarity is not materially reduced
- [ ] Key labels (runs/lifts/peaks) remain readable without requiring excessive zoom
- [ ] Terrain adds useful context (slope shape/depth) beyond contours alone

Decision rule:
- Fail this section if terrain reduces patrol overlay readability in a way that changes operational usability.

## Tuning Rubric (If Adjustments Are Needed)

Apply the smallest change that fixes the issue. Tune in `/Users/piovese/Documents/Patrol Toolkit/src/map/terrain-config.ts`.

If overlays are too hard to read:
- reduce `TERRAIN_FAUX_SHADING_INTENSITY`
- reduce contour line opacities (`TERRAIN_CONTOUR_*_LINE_OPACITY_STOPS`)
- reduce contour label opacities or increase spacing

If terrain depth cue is too weak:
- increase `TERRAIN_FAUX_SHADING_INTENSITY` slightly
- adjust faux shading opacity stops
- increase hypsometric tint contrast (color stops) only if necessary

If contour labels are too dense:
- increase `TERRAIN_CONTOUR_MAJOR_LABEL_SPACING` / `TERRAIN_CONTOUR_MINOR_LABEL_SPACING`
- raise `TERRAIN_CONTOUR_MINOR_LABEL_MIN_ZOOM`

If peak labels collide:
- tune `TERRAIN_PEAK_LABEL_RADIAL_OFFSET`
- tune `TERRAIN_PEAK_LABEL_VARIABLE_ANCHORS`
- raise `TERRAIN_PEAK_LABEL_ELEVATION_DETAIL_MIN_ZOOM`

## Result Summary (Fill Before Closing Slice 12)

- Primary resort tested:
- Additional resort tested:
- Viewports tested:
- Offline parity status:
- Terrain on/off comparison result:
- Tuning changes required (if any):
- Remaining issues / rationale:
