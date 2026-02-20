# Slice 8 Real Resort Validation (v1)

## Scope
- Resort: `CA_Golden_Kicking_Horse`
- Objective: verify option `9` output is production-usable online and offline.

## Acceptance Checklist
- [x] Option `9` completes without manual PMTiles/style input.
- [x] Generated artifact check passes.
- [x] Published artifact check passes.
- [x] Version basemap files exist:
  - `resorts/CA_Golden_Kicking_Horse/v1/basemap/base.pmtiles`
  - `resorts/CA_Golden_Kicking_Horse/v1/basemap/style.json`
- [x] Published basemap files exist:
  - `public/packs/CA_Golden_Kicking_Horse/base.pmtiles`
  - `public/packs/CA_Golden_Kicking_Horse/style.json`
- [x] App online render verified (basemap + overlays).
- [x] App offline render verified (basemap + overlays for generated area).

## Observed Build Evidence (2026-02-20)
- Provider: `openmaptiles-planetiler`
- Total runtime: `8m24s`
- Download phase: `7m41s` (cold cache bootstrap)
- Archive output size: `156kB`
- Features encoded: `18,068`
- Tile count: `11`
- Max gzipped tile size: `67k`
- Command result:
  - `Provider basemap build complete.`
  - `Generated artifact check passed: base.pmtiles, style.json.`
  - `Published artifact check passed: base.pmtiles, style.json.`

## Notes
- First run is dominated by provider dataset downloads and is expected to be slow.
- Warm-cache reruns should be significantly faster.
- Final manual result: online and offline maps confirmed working with basemap + overlays.
