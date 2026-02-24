# UI Spec v1

## Scope
- Defines v4 UI behavior and layout for the `/new` parallel UI path.
- Covers global component library and page composition for:
  - Select Resort page
  - Resort Page
- Covers all three viewports:
  - `small`
  - `medium`
  - `large`

## Source References
- `/Users/piovese/Documents/Patrol Toolkit/spec/UX/UIs v1.png`
- `/Users/piovese/Documents/Patrol Toolkit/spec/UX/UI components/` (generic pixel-perfect component visual specs library)
- `/Users/piovese/Documents/Patrol Toolkit/spec/XD/design_system_spec_v1.md`
- `/Users/piovese/Documents/Patrol Toolkit/roadmaps/roadmap_v4.md`

## Additional Visual Reference Library (v1)
- Generic pixel-perfect UI component visual specs are stored in:
  - `/Users/piovese/Documents/Patrol Toolkit/spec/UX/UI components/`
- Use this folder as the component-level visual reference source when implementing or auditing `/new` UI components (buttons, tabs, cards, overlays, nav bars, dialogs, etc.), together with page-level visuals in `UIs v1.png`.

## Routing / Entry Behavior (Locked)
- `/new` is the v4 parallel UI path during implementation.
- First-use / no active resort:
  - default to Select Resort page.
- Returning user with last active resort available:
  - default to Resort Page for that resort.
- Returning user with missing/invalid last active resort:
  - fall back to Select Resort page
  - show a non-blocking message explaining the previous resort could not be restored
- Select Resort remains the path for:
  - initial setup
  - explicit resort switching

## Global Component Library (Define First)

### 1. `ptk-app-shell`
- Responsibility:
  - top-level layout and page routing shell for `/new`
  - viewport classification (`small`, `medium`, `large`) distribution
  - theme application
- Inputs (conceptual):
  - current route
  - viewport mode
  - theme
- Outputs / events:
  - route navigation requests
  - theme change requests (delegated to Settings/Help)
- States:
  - loading app bootstrap
  - ready
  - recoverable error (render fallback shell state)

### 2. `ptk-page-header`
- Reusable page header component.
- Must support variants:
  - Select Resort header
  - Resort Page header
- Resort Page title behavior (v1):
  - resort name shown on one line only
  - display text is capitalized
  - truncate when needed (no wrapping)
  - no tap/long-press expand affordance for truncated title in v1
  - active resort pack version is shown under the resort name (per visual spec)
- Resort Page summary metadata (v1):
  - runs/lifts counts are visible on all viewports (`small`, `medium`, `large`)
  - rendered as separate one-line values (one line for runs, one line for lifts), per visual spec
- States:
  - default
  - compact
  - with actions

### 3. `ptk-search-input`
- Search input used on Select Resort page (and future search surfaces if needed).
- States:
  - idle
  - focused
  - typing
  - empty result context (paired with page state)
  - disabled

### 4. `ptk-resort-card`
- Displays resort identity + operational metadata.
- Required content:
  - resort name
  - location
  - thumbnail/status image area
  - installed/offline-ready state
  - update available badge
  - pack version
  - last updated time
- Metadata presentation (v1):
  - compact badges only for operational metadata (no secondary text rows)
- States:
  - default
  - pressed/selected
  - downloading
  - installed
  - update available
  - error

### 5. `ptk-map-surface`
- Map container/presentation shell.
- Map remains dominant visual surface on all viewports.
- Includes map control placement slots/regions.
- States:
  - loading
  - ready
  - map error
  - offline-ready

### 6. `ptk-tool-panel` (Responsive Primitive)
- Same component contract across all viewports.
- `small`:
  - bottom sheet presentation
  - collapsed / partial / expanded states
- `medium`, `large`:
  - left sidebar presentation
  - docked/persistent panel behavior
- States:
  - hidden
  - visible
  - section/tab selected
  - loading
  - empty
  - error

### 7. `ptk-segmented-tabs`
- Used for Resort Page tools navigation:
  - `My location`
  - `Runs Check`
  - `Sweeps`
- States:
  - default
  - selected tab
  - disabled tab (if any future condition)

### 8. `ptk-phrase-panel`
- Displays phrase generation output (content model unchanged in v4).
- Required elements:
  - phrase output block
  - trigger action (`Generate Phrase`)
  - status line (for example GPS readiness / generation status)
- GPS permission behavior (v1, `My location` context):
  - permission prompt is triggered immediately on Resort Page load
  - if permission is denied, blocked, or unavailable, show explicit guidance to re-enable location access
  - denied/blocked permission recovery guidance is presented in a modal dialog (v1)
  - if guidance modal is dismissed without enabling permission, `My location` shows non-blocking GPS-disabled state until user retries
  - primary recovery CTA label in GPS-disabled state: `Turn On Location`
  - if `Turn On Location` is triggered and permission remains denied/blocked, reopen the guidance modal
  - guidance must prevent dead-end states (user can understand next step and continue using the page)
- States:
  - idle (no phrase yet)
  - generating
  - success
  - error

### 9. `ptk-settings-panel`
- Settings/Help panel surface and sections.
- Includes:
  - theme switcher
  - install app
  - app update
  - resort pack update management
- States:
  - default
  - checking updates
  - update available
  - partial success
  - error

### 10. `ptk-map-controls`
- Resort Page map controls (v4 scope only):
  - center to user position
  - full screen
- States:
  - enabled
  - disabled (for unsupported state)
  - loading (brief action feedback)

## Component API Contracts (Lit, v1 Baseline)
- Every `/new` component spec must define before code implementation:
  - props (public reactive inputs)
  - events (emitted intents/results)
  - slots (where applicable)
  - owned UI state vs external state
- UI components must not own domain/business logic.
- Temporary duplicate wiring is allowed during v4 transition, but component boundaries still follow view-only contracts.

## Page Spec 1: Select Resort Page

### Purpose
- Entry flow for first use and resort switching.
- Presents searchable resorts and installation/update readiness context.

### Common Behavior (All Viewports)
- Search-driven list/grid only (no sorting/grouping controls in v4).
- Search filters by resort name and location only (v1).
- Returning to Select Resort resets search query to default (no query memory in v1).
- Tapping a resort card opens Resort Page immediately (no intermediate details preview in v1).
- If the selected resort is not installed/offline-ready, Resort Page opens in a dedicated blocking install/download state (map not shown until ready).
- In the blocking install/download state (v1), user does not navigate back to Select Resort directly from page-level back action.
- If blocking install/download fails (v1), primary recovery action is `Retry`.
- On repeated blocking install/download failure (v1), show persistent inline error plus secondary `Cancel` action.
- `Cancel` from blocking install/download state returns to Select Resort (v1).
- Returning user behavior is handled at app entry (direct-to-resort), but Select Resort remains accessible.

### Layout - `small`
- Header with page title and search.
- Resort cards in compact list/grid suitable for phone touch targets.
- Card metadata remains legible without crowding.

### Layout - `medium`
- Header keeps same pattern as `small` (page title + search in header).
- Wider card layout with improved metadata readability.
- More cards visible per viewport without changing interaction model.

### Layout - `large`
- Header keeps same pattern as `small` (page title + search in header).
- Centered content column with constrained max width (not full-bleed wide grid).
- Stronger spacing and improved metadata readability within the constrained layout.
- Preserve same card behavior and metadata fields.

### States (Page Level)
- loading resorts
- empty search query (default list)
- no results
- offline with installed resorts available
- offline with no resorts available
- pack download/update in progress
- pack operation error
- `offline with no resorts available` (v1 behavior):
  - message-only state (no retry action, no Settings/Help shortcut button)

## Page Spec 2: Resort Page

### Purpose
- Main operational page after setup (de facto main page for returning users).
- Map-first terrain and operational context for field use.

### Common Behavior (All Viewports)
- Core tool navigation preserved:
  - `My location`
  - `Runs Check`
  - `Sweeps`
- Default selected tab on page open: `My location`
- Phrase output model remains unchanged in v4.
- Map controls:
  - all viewports: center to user position
  - `small`, `medium`: full screen
  - `large`: no fullscreen control
- Settings/Help available as a dedicated panel/surface entry.

### Layout - `small`
- Map dominant.
- `ptk-tool-panel` renders as bottom sheet.
- Sheet contains tabs and tool content.
- Default state on page load: fully open.
- Entering fullscreen map closes the tool panel completely.
- Exiting fullscreen map restores the previous tool-panel state (collapsed / partial / fully open).
- Phrase panel and tool states are available without losing map context.

### Layout - `medium`
- Map dominant.
- `ptk-tool-panel` renders as left sidebar.
- Default state on page load: hidden.
- Sidebar can be opened into visible/docked state per interaction behavior.
- Entering fullscreen map hides the tool panel completely.
- Exiting fullscreen map restores the previous tool-panel state (hidden / visible-docked).
- Tools and phrase content remain readable while map stays primary.

### Layout - `large`
- Map dominant with expanded left sidebar.
- Default state on page load: visible/docked.
- Improved spacing and persistent operational context.
- Desktop affordances can be denser, but same component contracts apply.
- Left sidebar uses fixed width token `--ptk-size-panel-resort-lg` (design-system sizing token), not a percentage width.
- Fullscreen map control is not shown on `large`.

### States (Page Level)
- map loading
- map ready
- map render error
- GPS unavailable / permission denied
- GPS active / paused (if represented in `/new` behavior)
- phrase idle
- phrase generating
- phrase success
- phrase error
- tool content loading/empty/error for each tab
- offline-ready status visible where applicable
- `Sweeps` tab (v1 temporary state):
  - explicit "not defined yet" state is allowed and intentional
  - include short message that this area is part of the roadmap and will be developed after feedback and data improvements

## Settings/Help Panel UX (Detailed v1 Expectations)
- Access point defined in page/header spec (exact placement per viewport to be implemented against image/spec layout).
- Contains:
  - app version and update status
  - `Check for updates`
  - `Install App`
  - theme switcher (`default`, `high-contrast`) using segmented control
  - offline resorts list and pack update actions
- `Install App` visibility (v1):
  - hidden when app is already installed
- Offline resorts list rows (v1):
  - status-only rows (non-interactive on row tap)
  - update actions are triggered by explicit panel actions, not by tapping rows
- `Check for updates` result feedback (v1):
  - no-update result is shown as inline status text in the panel
  - no toast notification for no-update result
  - update-available result is shown as inline status text in the panel plus primary `Update the App` action in the same panel
- Error/result messaging must be explicit and non-silent.
- Partial update failures must be summarized clearly.

## Interaction + State Spec Rules (All Components/Pages)
- Each component/page must specify:
  - visual state
  - trigger
  - transition behavior
  - resulting event or state change
- Loading/empty/error states are required, not optional.
- No accidental placeholder copy in final v4 UI implementation.
- Exception: intentional temporary roadmap state copy explicitly approved in this spec (v1 `Sweeps` tab).

## Keyboard / Focus / Touch Baseline
- Not a formal accessibility compliance initiative in v4.
- Baseline requirements for usability/debuggability:
  - focus state visible for interactive controls
  - touch targets suitable for phone use with gloves where practical
  - keyboard navigation should not break component state logic during development/testing

## Approval Checklist
- [x] Global component library list and responsibilities approved
- [x] Lit component API contract rules approved
- [x] Select Resort page layouts approved for `small`, `medium`, `large`
- [x] Resort Page layouts approved for `small`, `medium`, `large`
- [x] Returning-user default-to-last-active-resort behavior approved
- [x] Settings/Help panel contents and behavior approved
- [x] Map controls scope approved (center to user position + full screen only)
- [x] Required page/component states (loading/empty/error/success/etc.) approved
- [x] No unresolved UI behavior questions blocking `Slice 2`
