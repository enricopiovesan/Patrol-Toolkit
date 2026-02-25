# v5 Slice 13: Contours / Elevation Prototype Implementation Outcome

## Outcome

- **Prototype implemented:** yes, behind configuration only.
- **Default shipping behavior:** unchanged (contour overlay is disabled unless explicitly configured).
- **Contour overlay type:** raster XYZ overlay rendered under resort overlays in `map-view`.
- **Elevation labels/data UI:** not implemented in `v5`.

## What was implemented

`map-view` now supports an optional contour raster overlay controlled by environment variables.

When configured, the overlay:

- renders beneath resort overlays (runs/lifts/boundaries/labels)
- preserves existing map interactions
- is disabled automatically when config is missing/invalid

## Prototype configuration (Vite env)

Set these values to enable the contour overlay prototype:

- `VITE_CONTOUR_TILES_URL` (required)
  - raster XYZ URL template containing `{z}`, `{x}`, `{y}`
- `VITE_CONTOUR_ATTRIBUTION` (optional)
- `VITE_CONTOUR_TILE_SIZE` (optional, default `256`)
- `VITE_CONTOUR_MIN_ZOOM` (optional, default `12`)
- `VITE_CONTOUR_MAX_ZOOM` (optional, default `16`)
- `VITE_CONTOUR_OPACITY` (optional, default `0.6`)

Example (illustrative; provider must be validated separately):

```bash
VITE_CONTOUR_TILES_URL="https://example.com/contours/{z}/{x}/{y}.png"
VITE_CONTOUR_ATTRIBUTION="© Contour Provider"
VITE_CONTOUR_MIN_ZOOM=12
VITE_CONTOUR_MAX_ZOOM=16
VITE_CONTOUR_OPACITY=0.6
```

## Constraints / what is still not solved

- A production contour data provider is **not selected** in `v5`.
- Licensing/redistribution for a specific contour source still requires explicit validation.
- Offline contour packaging is **not implemented** in `v5`.
- Elevation labels or per-feature elevation readout UX is **not implemented** in `v5`.

## Shipping recommendation (v5)

- Keep the contour prototype **config-gated** and disabled by default.
- Do not advertise as a supported user-facing v5 feature yet.
- Use this implementation to validate readability/performance with a selected source in a follow-up slice or v6.
