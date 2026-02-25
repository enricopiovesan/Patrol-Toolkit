# Roadmap v5

## Scope
- Focus v5 on usability improvements, small bug fixes, and interaction polish.
- Keep production behavior stable while improving UX friction points on the v4 UI.
- Continue map-first operation on the Resort Page.
- Include targeted map enhancement feasibility work (aerial view, contours/elevation) under free/offline constraints.
- Keep app to two pages:
  - Select Resort
  - Resort Page

## Constraints
- No backend/server work in v5.
- Business logic coverage remains 100% (unit tests).
- No placeholders in production code or shipped UX copy (except intentional roadmap temporary states already approved).
- Preserve offline-first behavior after install and resort pack download.
- Same composite web components continue to support three viewports with viewport-specific behavior:
  - `small`
  - `medium`
  - `large`
- `small` and vertical iPad (`medium` portrait) may intentionally share the same layout behavior where specified.
- Roadmap is deliverables-only; detailed UX/UI behavior updates live in versioned Markdown specs under `spec/XD`.

## v5 Non-Functional Requirements
- Production-quality code and UX polish.
- Clear separation between UI and business logic for all new behavior changes.
- UI components remain presentation-focused; interaction/business rules are testable in pure modules where practical.
- Responsive behavior is specified and tested for `small`, `medium`, and `large`.
- Slice acceptance includes viewport-specific manual checks and offline parity where relevant.
- New transient messaging UX (toasts) must not hide critical persistent/actionable states.

## Global Definition Of Done
- Code/spec changes merged with required tests.
- Business logic unit test coverage maintained at 100%.
- Manual slice acceptance checks completed for relevant viewports/states.
- `roadmap_v5.md` slice status updated in this file.
- No debug UI/chrome or transitional placeholder behavior ships in production code.

## Out of Scope (v5)
- New backend infrastructure.
- Full redesign program (v4 already completed the UI redesign baseline).
- Guaranteed shipping of aerial imagery or contour/elevation layers if free/offline constraints block implementation.
- Sweeps workflow definition/implementation beyond temporary-state UX alignment updates.

## Spec Deliverables (v5)
- v5 starts with a spec update gate before implementation.
- UX/UI behavior updates are versioned Markdown files under `/spec/XD`.
- v5 spec updates should capture:
  - bottom-sheet interaction and sizing refinements
  - toast behavior and message migration rules
  - phrase auto-regeneration UX
  - Select Resort distance sorting behavior
  - first-time install blocking flow back navigation changes
  - small viewport menu button sizing/tap target

## v5 UX Principles (Locked)
- `small` and vertical iPad (`medium` portrait) can share the same layout pattern when it improves usability.
- Bottom sheet handle and tabs remain fixed at the top of the sheet and never scroll with content.
- Bottom sheet expands to fit content first (up to max height), then content scrolls.
- Phrase behavior on `My location`:
  - phrase is auto-generated when GPS moves more than `10m` from the previous raw GPS point
  - button label is always `Re generate` when a usable position exists
  - button is hidden when no usable position exists
- If outside resort boundary:
  - phrase text shows `Outside resort boundaries`
  - `Re generate` button is hidden
- Toasts are used for transient messages only:
  - dismissible manually
  - auto-dismiss after `10s`
  - max `2` visible toasts
- Persistent/actionable states remain inline (e.g., blocking install errors, GPS-disabled state).
- Select Resort sorting:
  - if GPS is available, sort nearest-first
  - resorts without sortable location data remain after sortable resorts in original relative order
- Runs Check tab uses the same temporary-state structure as Sweeps, but with Runs Check wording.
- Aerial-view and contour/elevation work are feasibility/prototype outcomes in v5 (best-effort), not guaranteed shipping features.

## Slice 1: v5 Spec Update Gate (No UI Code)
- Status: completed
- Goal: lock v5 UX behavior changes before implementation begins.
- Deliverables:
  - update `/spec/XD/ui_spec_v1.md` (or create a versioned successor if needed) with v5 behavior deltas
  - update component specs impacted by v5 changes (bottom sheet, tabs/handle, toasts, map controls, menu drawer, resort cards)
  - define toast UX rules (placement, stacking, timing, dismissal)
  - define bottom-sheet interaction rules (fixed handle/tabs, sizing, drag behavior)
  - define phrase auto-regeneration behavior and boundary-state UX
  - define Select Resort distance sorting behavior and fallback ordering
  - define install-blocking back-navigation behavior
- Rules:
  - no production UI code changes in this slice
- Test / Acceptance:
  - spec review completed
  - no unresolved v5 UX behavior conflicts remain
- PR outcome: implementation slices can proceed without UX ambiguity.

## Slice 2: Bottom Sheet Interaction + Small/Medium Layout Polish
- Status: completed
- Goal: improve bottom-sheet usability and native-app feel on `small` and vertical iPad (`medium` portrait).
- Deliverables:
  - align `small` and vertical-`medium` layout behavior where specified
  - increase handle tap target without changing visual handle size
  - keep handle + tabs fixed at top of sheet (non-scrolling)
  - bottom sheet sizes to content first (up to max height)
  - remove page-scroll feel; keep app-native scrolling behavior
  - ensure map controls stay positioned above sheet (target offset maintained)
- Test / Acceptance:
  - no full-page scroll on Resort Page `small` / vertical `medium`
  - handle/tabs remain fixed while content scrolls
  - drag/resize behavior remains stable
  - map controls remain correctly positioned relative to sheet top
- PR outcome: bottom-sheet UX is significantly more usable and spec-aligned.

## Slice 3: Phrase UX Auto-Regeneration + Boundary-State Behavior
- Status: completed
- Goal: reduce manual friction in phrase workflow and improve phrase state clarity.
- Deliverables:
  - auto-generate phrase when `My location` tab is active and GPS moves > `10m` from previous raw GPS point
  - phrase remains visible (no empty output after initial generation cycle)
  - rename button to `Re generate`
  - hide phrase button when no usable position exists
  - show `Outside resort boundaries` when user is outside resort boundary
  - hide `Re generate` button in outside-boundary state
- Test / Acceptance:
  - auto-regeneration works only on `My location` tab
  - no regressions to manual phrase generation path
  - outside-boundary behavior matches spec
  - offline fallback phrase behavior still works
- PR outcome: phrase workflow is more automatic and clearer to users.

## Slice 4: Toast System + Message Migration
- Status: completed
- Goal: centralize transient messaging and reduce inline message clutter.
- Deliverables:
  - implement toast system (component + queue/state)
  - manual dismiss and auto-dismiss at `10s`
  - max `2` visible toasts
  - migrate transient messages to toasts
  - keep persistent/actionable states inline (blocking install, GPS-disabled, etc.)
  - align toast visuals to component specs under `spec/UX/UI components`
- Test / Acceptance:
  - toast queue/stack behavior works as specified
  - messages auto-dismiss after timeout
  - manual dismiss works
  - no critical state guidance lost from inline UI
- PR outcome: consistent transient messaging UX across the app.

## Slice 5: Resort Install Blocking Flow UX Fixes
- Status: completed
- Goal: reduce friction when opening a resort that is not yet installed.
- Deliverables:
  - add back navigation via top header back arrow in install-blocking state
  - keep first-time CTA wording clear (`Install resort data`)
  - keep retry behavior only after a real failure
  - move transient install notices to toasts where appropriate
- Test / Acceptance:
  - first-time install path is clear and reversible
  - retry path appears only after failure
  - cancel/back navigation returns user safely to Select Resort
- PR outcome: first-time resort entry flow is less confusing.

## Slice 6: Select Resort Distance Sorting + Card Usability Polish
- Status: completed
- Goal: improve resort selection usefulness in the field.
- Deliverables:
  - sort resorts by nearest distance when GPS position is available
  - preserve fallback ordering when GPS is unavailable
  - keep unsortable resorts after sortable resorts in original relative order
  - small visual polish for Select Resort card usability if needed (within v4 design system)
- Test / Acceptance:
  - nearest-first ordering works with GPS
  - fallback ordering is stable without GPS
  - no regressions in search filtering behavior
- PR outcome: Select Resort page is more useful in real-world field context.

## Slice 7: Small Viewport Menu Button + Drawer Polish
- Status: completed
- Goal: improve Settings/Help entry usability on small screens.
- Deliverables:
  - increase small viewport menu icon size
  - increase tap target size for menu button
  - preserve current header composition and behavior
  - final polish pass on menu drawer spacing/weight where needed
- Test / Acceptance:
  - menu button is easier to tap on phones
  - no regression to drawer open/close behavior
  - layout remains spec-aligned
- PR outcome: Settings/Help access is more reliable on small screens.

## Slice 8: Runs Check Temporary-State UX Alignment
- Status: completed
- Goal: align Runs Check temporary-state UX with Sweeps temporary-state UX.
- Deliverables:
  - Runs Check tab shows same temporary-state structure as Sweeps
  - copy uses Runs Check wording (not Sweeps wording)
  - styling and behavior consistent across viewports
- Test / Acceptance:
  - Runs Check and Sweeps temporary states are structurally aligned
  - no placeholder/debug copy leaks into production UI
- PR outcome: tab temporary states are consistent and intentional.

## Slice 9: Aerial View Feasibility (Free / Online / Offline Constraints)
- Status: completed
- Goal: determine if a free aerial-view toggle is viable within project constraints.
- Deliverables:
  - evaluate free aerial tile/source options for online usage
  - evaluate offline feasibility/licensing for aerial basemap packaging
  - prototype integration path if feasible
  - document outcome and constraints (ship/no-ship decision for v5)
- Test / Acceptance:
  - documented feasibility outcome exists
  - if prototyped, integration does not regress current map behavior
- PR outcome: clear decision on aerial-view support path.
  - Outcome (v5): no shipped aerial toggle; documented online-only prototype path (MapTiler-style key-gated raster) and no offline aerial packaging in v5.

## Slice 10: Contours / Elevation Feasibility (Best-Effort)
- Status: completed
- Goal: determine if contour lines and elevation visualization can be added under current data/tool constraints.
- Deliverables:
  - evaluate available contour/elevation data sources and licensing
  - evaluate online vs offline rendering feasibility
  - prototype contour overlay if feasible
  - document outcome and constraints (ship/no-ship decision for v5)
- Test / Acceptance:
  - documented feasibility outcome exists
  - if prototyped, overlay is legible and does not break map performance/UX
- PR outcome: clear decision on contour/elevation support path.
- Outcome:
  - documented in `/Users/piovese/Documents/Patrol Toolkit/docs/feasibility/v5-contours-elevation-feasibility.md`
  - no shipped contour/elevation feature in `v5`
  - post-v5 prototype path documented

## Slice 11: v5 QA Pass + Spec-to-Code Audit + Closeout
- Status: planned
- Goal: finish v5 with a focused usability regression pass and documentation closure.
- Deliverables:
  - audit v5 implementation against updated specs
  - verify toast/message behavior across key flows
  - verify phrase auto-regeneration and boundary-state behavior
  - verify bottom-sheet/map control interactions across `small`/`medium`/`large`
  - summarize feasibility outcomes for aerial/contours in roadmap/docs
  - update README if user-visible behavior changed materially
- Test / Acceptance:
  - full regression suite passes (`npm run check`)
  - manual v5 acceptance checks pass on all relevant viewports
  - roadmap slice statuses updated to completed
- PR outcome: v5 usability and bug-fix program is complete and documented.

## Open Decisions (Track During v5)
- None yet. Add only active decisions that block implementation or acceptance.
