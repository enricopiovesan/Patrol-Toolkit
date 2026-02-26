# v5 Slice 13-14: Contours / Elevation Prototype Implementation Outcome (Vector Foundation + CLI Automation)

## Outcome

- **Prototype direction implemented:** vector contour rendering foundation (same architecture direction as runs/lifts overlays).
- **CLI management path implemented:** contour import command + DEM-backed contour sync command + peaks sync command for resort workspace/publish flow.
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

3. `resort-sync-contours`
   - downloads DEM for a buffered resort boundary bbox (OpenTopography in v5 path)
   - runs local `gdal_contour` to generate contour GeoJSON
   - imports/normalizes contours into `workspace.layers.contours`

Interactive menu path (v5):

- `Fetch/update other things`
  - `Peaks`
  - `Contours`

Both layers are included in:

- `resort-export-latest`
- `resort-publish-latest`
- app export-bundle conversion (`layers.contours`, `layers.peaks`)

## What is not implemented in v5 (after Slice 14)

- No contour generation path without local setup (`PTK_OPENTOPO_API_KEY` + `gdal_contour`)
- No contour data in current published resort packs by default (until user runs contour sync/import and publishes)
- No elevation labels/readout UX beyond line label support
- No packaged DEM source management/caching strategy beyond per-run download
- No “one-click no-key” contour source (provider key required in v5 automation path)

## Why this is still useful

This foundation proves the app can render contours the same way it renders resort overlays:

- vector data
- bundled/offline-compatible architecture path
- MapLibre line/symbol layers under app control

It removes the need for a raster contour overlay path for the contour prototype direction.

## How to use the v5 contour path

1. Set OpenTopography API key (`PTK_OPENTOPO_API_KEY`).
2. Install GDAL and ensure `gdal_contour` is available.
   - Standard (Homebrew): `brew install gdal`
   - If Homebrew is unavailable: install QGIS and set `PTK_GDAL_CONTOUR_BIN` to the bundled tool, e.g. `/Applications/QGIS*.app/Contents/MacOS/gdal_contour`
3. Run contour sync from CLI (`resort-sync-contours`) or menu (`Fetch/update other things -> Contours`).
4. Publish latest version and verify contours in the app.

## Shipping recommendation (v5)

- Keep this as a **vector rendering + CLI automation prototype** in v5.
- Do not claim complete contour coverage/quality until contour generation defaults (interval/simplification/filtering) are tuned and validated across more resorts.
