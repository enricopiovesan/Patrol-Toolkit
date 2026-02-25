# v5 Slice 13: Contours / Elevation Prototype Implementation Outcome (Vector Foundation)

## Outcome

- **Prototype direction implemented:** vector contour rendering foundation (same architecture direction as runs/lifts overlays).
- **Default shipping behavior:** unchanged; no contours are shown unless contour data exists in the resort pack.
- **Elevation labels/data UI:** not implemented beyond optional contour line label text support (`elevationMeters`) in the layer style.

## What was implemented

The app now supports **optional vector contour lines** in the resort pack path:

- `ResortPack.contours?: ContourLine[]`
- contour overlay extraction in `buildResortOverlayData(...)`
- contour line + label layers in `map-view`

This means contours can be rendered as vector overlays when contour geometry is generated and bundled into a resort pack.

## Data model (prototype foundation)

Contour line shape added to pack model:

- `id: string`
- `elevationMeters?: number`
- `line: LineString`

Notes:

- `elevationMeters` is optional so data generation can start with geometry-only contours if needed.
- Label layer only renders text when `elevationMeters` is present.

## What is not implemented in v5 Slice 13

- No contour generation pipeline (CLI/data build) yet
- No contour data in current published resort packs by default
- No elevation labels/readout UX beyond line label support
- No offline contour packaging workflow (generation/source side)

## Why this is still useful

This foundation proves the app can render contours the same way it renders resort overlays:

- vector data
- bundled/offline-compatible architecture path
- MapLibre line/symbol layers under app control

It removes the need for a raster contour overlay path for the contour prototype direction.

## Next step (post Slice 13)

To make contours visible for a resort, implement the generation/bundling path:

1. Select contour/elevation source and validate licensing/redistribution.
2. Generate contour vector lines for the resort boundary area.
3. Add generated contour lines to `ResortPack.contours`.
4. Validate readability/performance and bundle size impact.

## Shipping recommendation (v5)

- Keep this as a **vector rendering foundation** in v5.
- Do not claim shipped contour support until generation + data source path is implemented and validated.
