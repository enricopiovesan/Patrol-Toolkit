                                
# Patrol Toolkit

**Patrol Toolkit** is an offline-first, data-driven web platform designed to support mountain patrol operations in complex alpine environments.

It enhances clarity, reduces cognitive load, and accelerates terrain awareness without replacing radio or existing patrol workflows.

Radio remains the primary communication channel.  
Patrol Toolkit supports it.

---

## Why This Exists

Mountain terrain is complex. Patrol callouts must be precise and concise. Connectivity is unreliable. Terrain knowledge takes years to internalize.

Under pressure during an accident response, sweep, or low-visibility condition, hesitation and ambiguity on the radio increase cognitive load and slow coordination.

Patrol Toolkit exists to provide reliable, offline spatial intelligence that improves clarity and confidence in patrol communication.

---

## Vision

Patrol Toolkit is designed as a modular operational platform for mountain patrol teams.

Long term, it aims to support:

- GPS-to-radio location translation  
- Sweep route assistance  
- Terrain knowledge indexing  
- Operational overlays and context  
- Shared situational awareness  

All built on portable, structured Resort Packs that separate terrain data from application logic.

---

## Current Scope — Version 0.0.1

Version 0.0.1 focuses on one capability.

### Where Am I

Convert current GPS location into a concise, patrol-grade radio location phrase, fully offline.

### Included

- Offline Progressive Web App
- Resort Pack architecture
- GPS location display
- Deterministic geometry-based phrase generation
- One-tap copy of concise radio callout

### Explicitly Not Included

- Sweep workflows
- Shared tracking
- Dispatch integration
- Incident logging
- Backend services
- AI-generated phrasing

The objective is clarity under pressure. Nothing more.

---

## Core Principles

Patrol Toolkit is built under strict operational constraints.

### Offline First
All core functionality must work without network connectivity after initial install and pack download.

### Deterministic Logic
All operational phrasing is geometry-based and reproducible.  
No AI-generated text is used for location output.

### Data Driven
Resort-specific behavior is defined via structured Resort Packs.  
The application contains no hard-coded resort logic.

### Assistive Only
Patrol Toolkit supports decision-making.  
It never replaces radio, protocol, or operational judgment.

---

## Architecture

- TypeScript
- Lit Web Components
- MapLibre GL JS
- PMTiles for offline basemaps
- IndexedDB for local data storage
- Progressive Web App with Service Worker
- Pluggable GeoEngine interface, WebAssembly optional in future

All terrain intelligence is computed locally on device.

No backend is required for v0.0.1.

---

## Resort Packs

Each resort is defined through a portable data pack containing:

- Runs
- Lifts
- Lift towers
- Patrol places
- Threshold rules
- Basemap tiles

This architecture allows Patrol Toolkit to scale across multiple resorts without modifying core application logic.

---

## Roadmap Overview

### 0.0.x
Core location intelligence stabilization and real-world validation.

### 0.1.x
Operational assistance tools such as sweep reference overlays and terrain knowledge layers.

### 0.2.x
Optional shared situational awareness capabilities.

### 1.0.0
Stable, multi-resort operational platform.

Roadmap evolves based on real field feedback from patrol use.

---

## Safety Notice

Patrol Toolkit is an assistive tool.

It does not replace:

- Radio communication
- Established patrol protocols
- Operational training
- Situational judgment

Radio remains the authoritative communication channel at all times.

---

## Status

Early-stage development.  
Focused on field validation within real patrol operations.

---

## Local Development

Run locally:

```bash
npm install
npm run dev
```

Quality gate:

```bash
npm run check
```

Offline shell verification:

1. Build and preview with `npm run build && npm run preview`.
2. Open the app once online to allow service worker install and asset caching.
3. Disable network in browser devtools and reload.
4. Confirm the app shell still loads.

Field validation and release resources:

- [v0.0.1 field trial runbook](docs/field-trial/v0.0.1-runbook.md)
- [v0.0.1 patrol feedback template](docs/field-trial/v0.0.1-feedback-template.md)
- [v0.0.1 release notes and tagging procedure](docs/releases/v0.0.1.md)

---

## License

MIT.
