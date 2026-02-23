# Use Cases

## Scope
This file captures core product use cases that drive UX and implementation priorities.
It complements personas and roadmap deliverables.

## UC-01: Install App From GitHub Pages

### Actor
- Patroller (field device user)

### Preconditions
- Device has network access
- User can open the stable GitHub Pages URL

### Main Flow
1. User opens the app URL.
2. User opens Settings/Help.
3. User uses the install action/guidance.
4. App is installed as PWA (platform-specific flow).

### Success Outcome
- App can be launched from device home screen/app launcher.

## UC-02: Download Resort Pack And Select Active Resort

### Actor
- Patroller

### Preconditions
- App is installed or open in browser
- Network available for first download

### Main Flow
1. User lands on Select Resort page.
2. User searches for a resort.
3. User sees resort card status and metadata.
4. User downloads pack if not installed.
5. User selects resort.

### Success Outcome
- Selected resort becomes active and Resort Page opens with map context.

## UC-03: Generate Radio Phrase From Current Position

### Actor
- Patroller under radio pressure

### Preconditions
- Active resort selected
- Location permission granted
- Resort pack available locally

### Main Flow
1. User opens Resort Page (`My location` tool).
2. User sees current location on map with terrain context.
3. User triggers phrase generation.
4. App returns phrase text for radio use.

### Success Outcome
- User gets a clear phrase quickly without leaving map context.

## UC-04: Use Resort Page Offline

### Actor
- Patroller / Sweep patroller

### Preconditions
- App installed and warm cached
- Resort pack downloaded
- Device offline or poor connectivity

### Main Flow
1. User opens app offline.
2. User selects installed resort.
3. User uses Resort Page map and tools.
4. User generates phrase and references map overlays.

### Success Outcome
- Core app functions continue offline with no blocking dependency on network.

## UC-05: Check And Apply App Update (Manual)

### Actor
- Patroller managing device state

### Preconditions
- App installed
- Network available

### Main Flow
1. User opens Settings/Help.
2. User selects `Check for updates`.
3. App checks release metadata and compatibility.
4. User reviews update info and applies update.

### Success Outcome
- App updates safely without replacing a working install on failure.

## UC-06: Check And Apply Resort Pack Updates (Manual)

### Actor
- Patroller managing device state

### Preconditions
- One or more resort packs installed
- Network available

### Main Flow
1. User opens Settings/Help.
2. User selects `Check pack updates`.
3. App shows available updates and statuses.
4. User selects specific resorts to update.
5. App applies updates independently and reports results.

### Success Outcome
- Selected resort packs update successfully, with partial failures clearly reported if any occur.

## UC-07: View Resort Operational Context On Map

### Actor
- Patroller / Sweep patroller

### Preconditions
- Active resort selected

### Main Flow
1. User opens Resort Page.
2. User interacts with map and tools (`My location`, `Runs Check`, `Sweeps`).
3. User reads run/lift labels, tower numbers, and overlays.
4. User uses map controls (center to user, full screen).

### Success Outcome
- User can maintain map-first situational context while accessing tools.

## UC-08: Use New UI Across Viewports (v4)

### Actor
- Patroller on phone/tablet/desktop

### Preconditions
- v4 UI route (`/new`) is available during development and testing

### Main Flow
1. User opens app on `small`, `medium`, or `large` viewport.
2. User navigates Select Resort page and Resort Page.
3. Shared components adapt behavior by viewport (e.g., bottom sheet vs left sidebar).
4. User performs core tasks without changing mental model.

### Success Outcome
- Same composite components work across all three viewports with viewport-appropriate behavior.

## UC-09: Switch Theme At Runtime (v4)

### Actor
- Patroller managing readability preferences

### Preconditions
- v4 design system runtime themes implemented

### Main Flow
1. User opens Settings/Help.
2. User switches theme between `default` and `high-contrast`.
3. UI updates without page-specific code changes.

### Success Outcome
- Theme changes are immediate and consistent across pages/components.

## UC-10: v4 Cutover And Legacy UI Removal (Maintainer)

### Actor
- Product maintainer / builder

### Preconditions
- `/new` UI is spec-complete and audited

### Main Flow
1. Maintainer verifies spec-to-code audit results.
2. Maintainer cuts over to v4 UI as primary UI.
3. Maintainer validates regressions.
4. Maintainer removes old UI and obsolete logic in final cleanup slice.

### Success Outcome
- v4 becomes primary UI with clean codebase boundaries and no obsolete UI paths.
