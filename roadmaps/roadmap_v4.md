# Roadmap v4

## Scope
- Focus v4 on UX/UI redesign and implementation quality.
- Maintain production-grade behavior while allowing UX-driven behavior changes.
- Build a new parallel UI path under `/new` first, then cut over.
- Keep app to two pages:
  - Select Resort
  - Resort Page
- Use Lit web components for all new UI work.

## Constraints
- No backend/server work in v4.
- Business logic coverage remains 100% (unit tests).
- No hardcoded UI tokens (colors/fonts/spacing/etc.) in new UI implementation.
- No placeholders in production code or UX copy delivered by v4 slices.
- Same composite web components must support three viewports with viewport-specific behavior:
  - `small`
  - `medium`
  - `large`
- Roadmap is deliverables-only; detailed UI specs live in versioned Markdown files under `spec`.

## v4 Non-Functional Requirements
- Production-quality code and UX; pixel-accurate implementation against approved specs.
- Clear separation between UI and business logic by final cutover.
- UI components do not contain domain/business logic after cutover cleanup.
- Design system-driven styling so theme colors/fonts can change without rewriting component UI.
- Responsive behavior is specified and tested for `small`, `medium`, and `large`.
- Slice acceptance includes viewport-specific visual/regression checks (and offline parity where relevant).

## Global Definition Of Done
- Code/spec changes merged with required tests.
- Business logic unit test coverage maintained at 100%.
- Manual slice acceptance checks completed for relevant viewports/states.
- `roadmap_v4.md` slice status updated in this file.
- No obsolete UI/business logic remains after final cleanup slice.

## Out of Scope (v4)
- New backend infrastructure.
- Full domain-model redesign unrelated to UX/UI goals.
- Runtime feature flags for UI switching (v4 uses `/new` route only during transition).
- Accessibility program/compliance initiative as a primary v4 scope driver.

## Spec Deliverables (v4)
- UI specs are deliverables and versioned Markdown files under `/spec/XD`:
  - `design_system_spec_v1.md`
  - `ui_spec_v1.md`
- Spec files include approval checklists inside the files (no separate checklist file).
- `design_system_spec_v1.md` and `ui_spec_v1.md` must be approved before UI code work starts.

## v4 UI Principles (Locked)
- Themes:
  - `default`
  - `high-contrast`
- Theme tokens include at minimum:
  - colors
  - typography (including font family tokens)
  - spacing
  - sizing
  - radius
  - shadow
  - motion
  - exact viewport breakpoint ranges (`small`, `medium`, `large`)
- Select Resort page keeps search + card/list interaction model.
- After a resort has been selected, subsequent app opens default to the last active resort and open the Resort Page.
- Select Resort becomes the primary entry flow for first use / resort switching, while Resort Page is the de facto main page after setup.
- Resort Page keeps core navigation model:
  - `My location`
  - `Runs Check`
  - `Sweeps`
- Map remains dominant surface on all viewports.
- Shared responsive component pattern:
  - same component contract
  - `small` -> bottom sheet
  - `medium`/`large` -> left sidebar
- Settings/Help panel contains:
  - theme switcher (`default`, `high-contrast`)
  - install/update actions
  - resort/offline management UI
- Resort Page map controls (v4 target):
  - center to user position
  - full screen

## Slice 1: v4 Spec Gate (No UI Code)
- Status: completed
- Goal: lock the v4 design system and UI specs before implementation starts.
- Deliverables:
  - create `/spec/XD/design_system_spec_v1.md`
  - create `/spec/XD/ui_spec_v1.md`
  - define exact viewport breakpoints for `small` / `medium` / `large`
  - define design tokens (themes, type, spacing, radius, shadow, motion)
  - define global component library specs first (Lit-oriented component contracts)
  - define full page specs for both pages across all three viewports
  - define per component/page states and behavior:
    - default/selected/disabled/error/loading/empty
    - interactions/transitions
    - focus/keyboard behavior (debug/usability baseline)
  - define component naming conventions for Lit components (`ptk-*`, file naming, event naming)
  - define component API contracts (props/events/slots/state ownership)
- Rules:
  - no UI code changes in this slice
- Test / Acceptance:
  - spec review completed
  - approval checklists in both spec files completed
  - no unresolved UI architecture decisions blocking implementation
- PR outcome: v4 implementation can start without design ambiguity.

## Slice 2: `/new` App Shell + Routing + Responsive Layout Primitives
- Status: completed
- Goal: establish the parallel UI path and reusable viewport primitives.
- Deliverables:
  - create `/new` route/path (no runtime feature flag)
  - implement new app shell for `/new`
  - implement viewport detection/mapping (`small`, `medium`, `large`)
  - implement responsive layout primitives from specs, including shared bottom-sheet/left-sidebar component pattern
  - wire token/theme foundation into `/new` shell (default theme active)
  - keep current production UI untouched
- Test / Acceptance:
  - `/new` loads independently
  - viewport behavior matches spec in `small`, `medium`, `large`
  - no regression to existing UI route
- PR outcome: stable v4 UI foundation route exists.

## Slice 3: Design System Runtime Implementation (Themes + Tokens)
- Status: completed
- Goal: implement the design system in code so UI components are token-driven.
- Deliverables:
  - token infrastructure for colors/fonts/spacing/sizing/radius/shadow/motion
  - runtime theme switching support for `default` and `high-contrast`
  - no hardcoded styling values in new `/new` UI components (except temporary spec-dev scaffolding removed before merge)
  - token consumption patterns documented in component code conventions
- Test / Acceptance:
  - theme can switch at runtime in `/new`
  - theme changes do not require UI markup changes
  - visual sanity checks across `small`/`medium`/`large`
- PR outcome: `/new` UI styling is design-system driven.

## Slice 4: Select Resort Page (`/new`) - Full UI Implementation
- Status: completed
- Goal: implement the new Select Resort page UX across all viewports.
- Deliverables:
  - search UI per spec
  - resort card/list components using global component library
  - entry/resume UX rules for first use vs returning user (handoff to Resort Page when last active resort exists)
  - card content includes:
    - resort name
    - location
    - thumbnail/status
    - installed/offline-ready state
    - available update badge
    - pack version
    - last updated time
  - viewport-specific presentation for `small` / `medium` / `large` using same component contracts
- Test / Acceptance:
  - UI behavior and layout match approved specs across all three viewports
  - no sorting/grouping controls added in v4 (search-driven list/grid only)
  - offline state indicators render correctly
  - regression checks for existing data loading behavior
- PR outcome: Select Resort page is production-ready on `/new`.

## Slice 5: Resort Page (`/new`) - Skeleton + Core Layout
- Status: completed
- Goal: implement the new Resort Page structure and information hierarchy without changing phrase output model.
- Deliverables:
  - full Resort Page IA implementation per spec
  - default landing behavior for returning users with last active resort
  - map-first layout on all viewports
  - shared sheet/sidebar component behavior:
    - `small` bottom sheet
    - `medium` / `large` left sidebar
  - preserve current core navigation model (`My location`, `Runs Check`, `Sweeps`)
  - keep phrase output block model unchanged for v4
- Test / Acceptance:
  - spec match across `small`, `medium`, `large`
  - map remains visually dominant surface
  - panel behavior matches viewport contract
- PR outcome: Resort Page structure is implemented on `/new`.

## Slice 6: Resort Page (`/new`) - Settings/Help Panel Redesign
- Status: completed
- Goal: redesign and implement Settings/Help as a dedicated UX surface.
- Deliverables:
  - Settings/Help panel UI per spec
  - theme switcher (`default` / `high-contrast`) in Settings/Help only
  - install app action
  - app update action
  - resort/offline management UI (existing capabilities re-expressed in new UI)
  - state/error/success UX for update/install flows per UI spec
- Test / Acceptance:
  - theme switching works at runtime from Settings/Help only
  - install/update controls render and behave correctly across viewports
  - offline and partial-failure states render per spec
  - no business logic embedded directly in presentation-only components where avoidable
- PR outcome: Settings/Help panel is production-ready on `/new`.

## Slice 7: Resort Page (`/new`) - Map Controls Redesign + Integration
- Status: completed
- Goal: align map controls to v4 UI spec and simplify control surface.
- Deliverables:
  - implement v4 map controls:
    - center to user position
    - full screen
  - remove/replace old control affordances in `/new` page as specified
  - ensure controls fit the map-first layout and viewport behavior
- Test / Acceptance:
  - controls work in `small`, `medium`, `large`
  - map interaction remains reliable online/offline
  - visual placement matches spec
- PR outcome: map controls align with v4 UX direction.

## Slice 8: `/new` UI Feature Completion + UX Behavior Polish
- Status: completed
- Goal: complete remaining `/new` page interactions and behavioral polish from `ui_spec_v1.md`.
- Deliverables:
  - finish component/page behaviors not completed in prior slices
  - resolve state transitions, loading/empty/error experiences
  - polish spacing, motion, and responsive behavior across pages
  - maintain Lit component reuse and viewport-specific behavior via shared contracts
- Test / Acceptance:
  - all spec-defined states represented and working
  - viewport checks pass for both pages
  - offline parity checks for impacted UI flows
- PR outcome: `/new` UI is feature-complete against v1 specs.

## Slice 9: Spec-to-Code Audit (`/new` vs v1 Specs)
- Status: planned
- Goal: verify `/new` implementation matches approved specs before cutover.
- Deliverables:
  - audit `/new` against `design_system_spec_v1.md`
  - audit `/new` against `ui_spec_v1.md`
  - document and fix spec mismatches (layout, states, interactions, token usage)
  - capture screenshot evidence for `small`, `medium`, `large`
- Test / Acceptance:
  - no unresolved spec mismatches
  - screenshot evidence covers both pages across all viewports
  - theme behavior verified for `default` and `high-contrast`
- PR outcome: `/new` UI is spec-accurate and ready for cutover.

## Slice 10: Cutover to v4 UI (Keep Old UI Code Present)
- Status: planned
- Goal: switch app routing/default UX from legacy UI to the `/new` implementation safely.
- Deliverables:
  - make v4 UI the primary user experience
  - preserve operational behavior and critical workflows during cutover
  - keep old UI code available temporarily for rollback/compare if needed
- Test / Acceptance:
  - end-to-end manual checks on primary workflows across `small`, `medium`, `large`
  - online/offline parity checks
  - install/update/settings flows still work after cutover
- PR outcome: v4 UI is live as primary UI.

## Slice 11: Old UI Deletion + Business Logic Cleanup (Final v4 Cleanup)
- Status: planned
- Goal: remove obsolete UI and enforce final UI/business-logic separation.
- Deliverables:
  - delete legacy UI routes/components/pages no longer used
  - remove obsolete adapters/business logic created during parallel `/new` implementation
  - consolidate boundaries so UI components are presentation-focused
  - verify no dead code remains from v4 transition
  - update README screenshots to final v4 UI
- Test / Acceptance:
  - regression suite passes (`npm run check` and any relevant tooling checks)
  - manual regression checks pass on all three viewports
  - no unused legacy UI path remains
  - codebase reflects final separation of UI and business logic for v4 scope
- PR outcome: v4 is complete, clean, and production-ready.

## Open Decisions (Track During v4)
- None yet. Add only active decisions that block implementation or acceptance.
