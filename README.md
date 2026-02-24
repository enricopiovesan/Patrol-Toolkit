# Patrol Toolkit

Patrol Toolkit is an offline-first web app for mountain patrol operations.

It helps patrol teams:
- understand where they are on-mountain
- generate consistent radio-friendly location phrases
- use resort terrain data offline after install

Radio remains the primary communication channel. Patrol Toolkit is an assistive tool.

## What This Is

Patrol Toolkit is a map-first operational app built around portable **Resort Packs**.

Each resort pack contains the terrain and basemap data the app needs to work offline on a device. The app and the resort data are separated so the same app can support multiple resorts.

Core characteristics:
- offline-first after install and pack download
- deterministic phrase generation (geometry-based)
- no backend required for normal use
- one active resort context at a time (reduces ambiguity)

## Why This Exists

Mountain patrol communication requires clarity under pressure.

Terrain is complex, connectivity is unreliable, and local knowledge takes time to build. Patrol Toolkit exists to reduce ambiguity during radio communication by making location context easier to access and describe.

## Download and Install the App (Users)

Use the production app here:

- [Patrol Toolkit (GitHub Pages)](https://enricopiovesan.github.io/Patrol-Toolkit/)

### First-time setup

1. Open the app link while online.
2. Install the PWA from the app (`Settings / Help`) or your browser install flow.
3. Select a resort.
4. If the resort is not on the device yet, install/download the resort data when prompted.
5. Wait for the resort pack to finish installing.
6. Reopen the app and confirm the resort page loads.

### Offline use

1. Open the app once while online (to cache the app shell and assets).
2. Open your resort and allow the data to load.
3. After that, the app can operate offline for cached app + installed resort packs.

## Current Product Scope

Current v4 UI supports:
- `Select Resort` page (search + resort cards)
- `Resort Page` (map-first layout)
- offline resort pack install and use
- phrase generation
- Settings / Help drawer (theme, app install/update info, offline resorts status)

## Roadmap Focus: Runs Check and Sweeps

Patrol Toolkit is moving toward deeper operational workflows beyond phrase generation.

### Runs Check (next capability track)

Goal:
- support structured run-status workflows (inspection/check context on terrain)

Expected direction:
- map-first workflow integrated into the Resort Page
- run-focused UI states and task-oriented interactions
- deterministic, data-driven behavior (same operational constraints as phrase generation)

### Sweeps (future capability track)

Goal:
- support patrol sweep workflows after more field feedback and data improvements

Current state:
- `Sweeps` exists in the UI as an intentional placeholder state
- final workflow is not defined yet

The Sweeps capability will be shaped by:
- real patrol feedback
- data quality improvements
- validated operational use cases

## Usage Terms (Free, Non-Commercial)

This project is free to use for personal, educational, and non-commercial operational evaluation.

Not allowed without explicit permission:
- commercial use
- resale
- redistribution of the app or resort packs
- repackaging this project as a hosted or distributed commercial offering

If you want to use Patrol Toolkit in a commercial context or redistribute it, contact the project maintainer first.

## For Developers

### Local development

```bash
npm install
npm run dev
```

Quality gate:

```bash
npm run check
```

### Project areas

- App source: `/Users/piovese/Documents/Patrol Toolkit/src`
- Roadmaps: `/Users/piovese/Documents/Patrol Toolkit/roadmaps`
- UX/UI specs: `/Users/piovese/Documents/Patrol Toolkit/spec/XD`
- Tools workspace: `/Users/piovese/Documents/Patrol Toolkit/tools`

### Tools (data + resort pack workflows)

Start here:
- [`tools/README.md`](tools/README.md)

OSM extractor CLI:
- [`tools/osm-extractor/GET_STARTED.md`](tools/osm-extractor/GET_STARTED.md)
- [`tools/osm-extractor/README.md`](tools/osm-extractor/README.md)
- [`tools/osm-extractor/docs/menu-user-guide.md`](tools/osm-extractor/docs/menu-user-guide.md)
- [`tools/osm-extractor/docs/data-extraction-playbook.md`](tools/osm-extractor/docs/data-extraction-playbook.md)
- [`tools/osm-extractor/docs/troubleshooting.md`](tools/osm-extractor/docs/troubleshooting.md)
- [`tools/osm-extractor/docs/checklists/resort-handoff.md`](tools/osm-extractor/docs/checklists/resort-handoff.md)

## Roadmaps and Specs

- v4 roadmap (completed UI/UX program): [`roadmaps/roadmap_v4.md`](roadmaps/roadmap_v4.md)
- UI design system spec v1: [`spec/XD/design_system_spec_v1.md`](spec/XD/design_system_spec_v1.md)
- UI app spec v1: [`spec/XD/ui_spec_v1.md`](spec/XD/ui_spec_v1.md)
- Personas: [`spec/personas.md`](spec/personas.md)
- Use cases: [`spec/use-cases.md`](spec/use-cases.md)

## Safety Notice

Patrol Toolkit does not replace:
- radio communication
- patrol protocols
- training
- operational judgment

Use it as an assistive tool only.
