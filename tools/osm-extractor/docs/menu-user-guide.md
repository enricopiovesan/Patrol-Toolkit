# OSM Extractor Menu User Guide

This guide is for operators who want a guided CLI experience instead of memorizing command flags.

## Start Menu

From repository root:

```bash
npm --prefix tools/osm-extractor run run:menu
```

## What You Can Do In Menu

- Select known resort (latest version only).
- Search/select new resort (required prompts: `name`, `countryCode`, `town`).
- Detect or set boundary.
- Sync lifts.
- Sync runs.
- Check sync status.
- Generate offline basemap assets (`option 9`).

## Offline Basemap Generation (Option 9)

Option `9` builds basemap assets for the current resort version using provider
`openmaptiles-planetiler` when provider config is configured.

### Prerequisites (Required Before Option 9)

1. Install Java `21+` and verify:

```bash
java -version
```

2. Download Planetiler locally:

```bash
mkdir -p tools/bin
curl -L https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar \
  -o tools/bin/planetiler.jar
```

3. Verify Planetiler is runnable:

```bash
java -jar tools/bin/planetiler.jar --help
```

4. Keep the default `planetilerCommand` (or customize it) in
   `tools/osm-extractor/config/basemap-provider.json`.
   - default command uses `{osmExtractPath}` and auto-downloads/caches Geofabrik source data.
   - cache path: `resorts/.cache/geofabrik/`.
   - if command is empty, option `9` fails by design.

Default generation settings:

- boundary buffer: `1000m`
- max zoom: `15`

Default config file:

- `tools/osm-extractor/config/basemap-provider.json`
  - fields:
    - `provider` (`openmaptiles-planetiler`)
    - `bufferMeters` (default `1000`)
    - `maxZoom` (default `15`, must be `<=15` for Planetiler)
    - `planetilerCommand` (required)

Required config value:

- `planetilerCommand`:
  - local shell command template.
  - must output:
    - `base.pmtiles` at `{outputPmtiles}`
  - if `style.json` is missing after command, CLI writes a default offline vector style.
  - receives placeholders:
    - `{boundaryGeojson}` (current boundary polygon)
    - `{bboxCsv}` and `{minLon}/{minLat}/{maxLon}/{maxLat}` (boundary + buffer bbox)
    - `{maxZoom}`, `{bufferMeters}`, `{resortKey}`
    - `{outputPmtiles}`, `{outputStyle}`
    - `{osmExtractPath}` (resolved Geofabrik `.osm.pbf` path)
    - `{planetilerJarPath}` (auto-resolved local Planetiler jar path)

Optional environment overrides:

- `PTK_BASEMAP_CONFIG_PATH` (default: `tools/osm-extractor/config/basemap-provider.json`)
- `PTK_PLANETILER_JAR` (optional explicit path to `planetiler.jar`)

## Resort Storage Layout

Menu workflow stores data under root:

```text
resorts/
```

Per resort directory naming:

```text
CC_Town_Resort_Name
```

Example:

```text
resorts/CA_Golden_Kicking_Horse
```

Version folders are immutable:

```text
resorts/CA_Golden_Kicking_Horse/v1
resorts/CA_Golden_Kicking_Horse/v2
```

Each version includes `status.json` with stable metrics and manual validation flag.

## Expected Operator Workflow

1. Open menu.
2. Choose:
   - known resort if it already exists,
   - or search/select new resort.
3. If new resort, fill mandatory prompts:
   - Name
   - Country Code
   - Town
4. Select boundary candidate.
5. Sync lifts and runs.
6. Confirm status is complete.
7. Mark manual validation when field-tested.
