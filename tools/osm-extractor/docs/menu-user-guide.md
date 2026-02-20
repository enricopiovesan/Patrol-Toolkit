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

Default generation settings:

- boundary buffer: `1000m`
- max zoom: `16`

Default config file:

- `tools/osm-extractor/config/basemap-provider.json`
  - fields:
    - `provider` (`openmaptiles-planetiler`)
    - `bufferMeters` (default `1000`)
    - `maxZoom` (default `16`)
    - `planetilerCommand` (required)

Required config value:

- `planetilerCommand`:
  - local shell command template.
  - must output:
    - `base.pmtiles` at `{outputPmtiles}`
    - `style.json` at `{outputStyle}`
  - receives placeholders:
    - `{boundaryGeojson}` (current boundary polygon)
    - `{bboxCsv}` and `{minLon}/{minLat}/{maxLon}/{maxLat}` (boundary + buffer bbox)
    - `{maxZoom}`, `{bufferMeters}`, `{resortKey}`
    - `{outputPmtiles}`, `{outputStyle}`

Optional environment overrides:

- `PTK_BASEMAP_PROVIDER` (default: `openmaptiles-planetiler`)
- `PTK_BASEMAP_BUFFER_METERS` (default: `1000`)
- `PTK_BASEMAP_MAX_ZOOM` (default: `16`)
- `PTK_BASEMAP_PLANETILER_CMD`
- `PTK_BASEMAP_CONFIG_PATH` (default: `tools/osm-extractor/config/basemap-provider.json`)

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
