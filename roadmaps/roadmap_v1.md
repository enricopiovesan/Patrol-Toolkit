# Roadmap v1

## Slice 1: Basemap Config + Preconditions
- Status: completed (2026-02-20)
- Goal: solid config contract before generation.
- Changes:
  - finalize `tools/osm-extractor/config/basemap-provider.json` schema validation in CLI.
  - clear errors for missing/invalid `planetilerCommand`.
- Test:
  - option `9` fails with actionable config errors.
  - valid config passes precheck.
- PR outcome: deterministic setup validation.

## Slice 2: Boundary Geometry Pipeline
- Goal: reliable boundary->buffered bbox input.
- Changes:
  - harden boundary ring extraction (Feature/FeatureCollection/MultiPolygon).
  - add bbox + 1000m buffer utility tests.
- Test:
  - option `9` computes bbox for known resort.
  - invalid boundary gives precise error.
- PR outcome: trusted AOI computation.

## Slice 3: Geofabrik Resolver + Cache
- Goal: free data source automation.
- Changes:
  - implement country->Geofabrik extract resolver.
  - download with cache directory + reuse.
- Test:
  - first run downloads extract.
  - second run reuses cache (no redownload).
- PR outcome: local free data source works.

## Slice 4: Provider Runner (Planetiler Command)
- Goal: execute local generator end-to-end.
- Changes:
  - render command placeholders (`{bboxCsv}`, `{outputPmtiles}`, etc).
  - run command + stream output + exit code handling.
- Test:
  - stub command writes PMTiles/style successfully.
  - failing command surfaces clean error.
- PR outcome: provider execution reliable.

## Slice 5: Option 9 End-to-End Build Path
- Goal: no manual inputs, full generation flow.
- Changes:
  - option `9` triggers: boundary->extract resolve->provider run->offline validation.
  - shared basemap write to `resorts/<resortKey>/basemap`.
- Test:
  - option `9` generates shared basemap from scratch.
  - generated artifact checks pass.
- PR outcome: operator can run one menu action.

## Slice 6: Publish + Post-Checks
- Goal: guarantee deliverable assets.
- Changes:
  - enforce generated + published artifact existence checks.
  - include size metrics in output.
- Test:
  - `Generated artifact check passed`.
  - `Published artifact check passed`.
- PR outcome: high-confidence output integrity.

## Slice 7: Docs + Operator Runbook
- Goal: make it usable by others.
- Changes:
  - README + menu guide with exact config, cache path, troubleshooting.
  - example commands and expected outputs.
- Test:
  - clean-machine walkthrough by following docs only.
- PR outcome: handoff-ready.

## Slice 8: Real Resort Validation
- Goal: prove on real workflow.
- Changes:
  - run on `CA_Golden_Kicking_Horse`.
  - capture timings, output sizes, and offline app verification checklist.
- Test:
  - online then offline map renders with generated basemap (not just overlays).
- PR outcome: release confidence.
