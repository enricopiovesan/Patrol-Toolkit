# Personas

## Persona 1: Field Patroller Under Radio Pressure

### Context
- On mountain
- Low connectivity possible
- Wearing gloves
- Uses phone most often, but may also use tablet
- Needs precise radio phrasing and immediate terrain context

### Core Need
Know current position inside the active resort boundary and produce a clear radio call quickly.

### Success Criteria
- Open app fast and resume active resort without friction
- See map context immediately (runs/lifts/boundary and future area overlays when available)
- Generate phrase quickly from current location
- Continue working offline after initial install and pack download

## Persona 2: Patroller During Sweep / Route Verification

### Context
- Moving through runs and lifts while checking terrain status
- Needs map-first UI and clear route/feature visibility
- Uses the same app session for repeated lookups

### Core Need
Navigate the resort map and operational tools quickly without losing map context.

### Success Criteria
- Resort page remains map-dominant on all viewport sizes
- Tools panel is easy to access (`small` bottom sheet, `medium/large` sidebar)
- Runs/lifts labels and overlays remain readable in dense areas
- Offline behavior is consistent with online behavior after warm cache

## Persona 3: Patroller Managing Device State In The Field

### Context
- Needs to install/update app and resort packs without technical steps
- May need to verify what is available offline before heading out
- Uses Settings/Help panel occasionally, not as the main workflow

### Core Need
Manage install/update/theme/offline resort data safely without breaking field readiness.

### Success Criteria
- Can install app from GitHub Pages flow using in-app guidance
- Can check for app updates and pack updates manually
- Can understand installed/offline-ready/update-available states
- Can switch theme (`default`, `high-contrast`) from Settings/Help only

## Persona 4: Product Maintainer / Builder (Non-Field Workflow)

### Context
- Prepares releases, publishes resort packs, and validates quality
- Works in CLI + GitHub + local testing environment
- Needs predictable workflows and clear artifacts

### Core Need
Ship stable app and resort updates without backend infrastructure and with auditable quality gates.

### Success Criteria
- Release and publish flow is repeatable and documented
- Resort bundles are versioned and testable
- UI specs and implementation slices can be reviewed independently
- Dead/obsolete UI paths are removed after cutover
