# v5 Slice 13: Contours / Elevation Prototype Implementation Outcome (Vector Foundation + CLI Management)

## Outcome

- **Prototype direction implemented:** vector contour rendering foundation (same architecture direction as runs/lifts overlays).
- **CLI management path implemented:** contour import command + peaks sync command for resort workspace/publish flow.
- **Default shipping behavior:** unchanged; no contours are shown unless contour data exists in the resort pack.
- **Peak support:** optional peak points can now be managed/published/rendered as part of the same pack path.
- **Elevation labels/data UI:** not implemented beyond optional contour line label text support (`elevationMeters`) in the layer style.

## What was implemented

The app now supports **optional vector contour lines** and **optional peak points** in the resort pack path:

- `ResortPack.contours?: ContourLine[]`
- `ResortPack.peaks?: Peak[]`
- contour overlay extraction in `buildResortOverlayData(...)`
- peak overlay extraction in `buildResortOverlayData(...)`
- contour line + label layers in `map-view`
- peak symbol/label layers in `map-view`

This means contours and peaks can be rendered as vector overlays when data is bundled into a resort pack.

## Data model (prototype foundation)

Contour line shape added to pack model:

- `id: string`
- `elevationMeters?: number`
- `line: LineString`

Notes:

- `elevationMeters` is optional so data generation can start with geometry-only contours if needed.
- Label layer only renders text when `elevationMeters` is present.

Peak point shape added to pack model:

- `id: string`
- `name: string`
- `point: Point`
- `elevationMeters?: number`

Notes:

- Peak labels use `name` and optionally elevation metadata if present.
- Initial peak sync uses OSM `natural=peak` nodes via Overpass.

## CLI management path implemented

Two CLI commands now support the vector contour/peak data workflow:

1. `resort-import-contours`
   - imports external contour GeoJSON (`LineString` / `MultiLineString`)
   - normalizes to contour line features
   - updates `workspace.layers.contours`

2. `resort-sync-peaks`
   - queries OSM Overpass for `natural=peak` nodes within buffered resort boundary bbox
   - writes `peaks.geojson`
   - updates `workspace.layers.peaks`

Both layers are included in:

- `resort-export-latest`
- `resort-publish-latest`
- app export-bundle conversion (`layers.contours`, `layers.peaks`)

## What is not implemented in v5 Slice 13

- No contour generation pipeline from DEM/elevation rasters yet (CLI/data build)
- No contour data in current published resort packs by default (unless manually imported)
- No elevation labels/readout UX beyond line label support
- No automated offline contour generation workflow (source side)

## Why this is still useful

This foundation proves the app can render contours the same way it renders resort overlays:

- vector data
- bundled/offline-compatible architecture path
- MapLibre line/symbol layers under app control

It removes the need for a raster contour overlay path for the contour prototype direction.

## Next step (post Slice 13)

To make contours visible for a resort, implement the generation/bundling path:

1. Select contour/elevation source and validate licensing/redistribution.
2. Generate contour vector lines for the resort boundary area (DEM-based pipeline).
3. Import/publish contours via `resort-import-contours` (or future generator command).
4. Optionally sync peaks via `resort-sync-peaks`.
5. Validate readability/performance and bundle size impact.

## Shipping recommendation (v5)

- Keep this as a **vector rendering + CLI management foundation** in v5.
- Do not claim complete contour coverage until DEM-based generation + source path is implemented and validated.
