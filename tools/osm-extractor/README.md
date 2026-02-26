# OSM Extractor CLI

`osm-extractor` is an offline-capable CLI that transforms local OpenStreetMap JSON into deterministic Patrol Toolkit artifacts.

## What It Produces

- Single-resort artifacts:
  - normalized source JSON
  - `pack.json`
  - extraction `report.json`
  - `provenance.json`
- Fleet artifacts:
  - `fleet-manifest.json`
  - `fleet-provenance.json`
- Optional audit log:
  - JSONL event stream

## Prerequisites

- Node.js 20+
- Local OSM JSON input files for `ingest-osm`/`build-pack`/`extract-*` workflows
- Network access for resort acquisition commands (`resort-search`, `resort-boundary-*`, `resort-sync-*`, `resort-update`)

## Get Started

1. Install dependencies:

```bash
npm --prefix tools/osm-extractor install
```

2. Open the CLI menu (shows all commands and flags):

```bash
npm --prefix tools/osm-extractor run run:menu
```

3. Run quality checks before real extraction:

```bash
npm --prefix tools/osm-extractor run check
```

## Operator Happy Path (Menu)

Use this flow when you want guided onboarding/update without remembering flags.

1. Start menu:

```bash
npm --prefix tools/osm-extractor run run:menu
```

2. Create/select resort:
- `1. Resort list` for known resorts.
- `2. New Resort` for onboarding.

3. In resort submenu:
- `2/3/4` for single-layer sync (`boundary`, `runs`, `lifts`).
- `5` for immutable multi-layer update in one new version.
- `9` to generate offline basemap assets for the current version using a local provider command (defaults: buffer `1000m`, max zoom `15`).
- `6/7/8` to mark layer manual validation.
  - when all three are validated, the menu auto-publishes latest validated bundle to app catalog (`public/packs` + `public/resort-packs/index.json`).
  - auto-publish also copies basemap assets from `resorts/<resortKey>/<version>/basemap/base.pmtiles` and `resorts/<resortKey>/<version>/basemap/style.json` into `public/packs/<resortKey>/`.
- `1` to verify readiness/metrics.

4. Optional explicit publish command (same output as auto-publish):

```bash
node tools/osm-extractor/dist/src/cli.js resort-publish-latest \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --resort-key CA_Golden_Kicking_Horse \
  --exported-at 2026-02-19T16:35:00.000Z
```

## Quality Gate

```bash
npm --prefix tools/osm-extractor run check
```

## Release Candidate Gates (v3)

Build CLI first:

```bash
npm --prefix tools/osm-extractor run build
```

Dry-run release checks for currently published scope:

```bash
node tools/osm-extractor/dist/src/cli.js release-dry-run \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --published-only
```

Run strict go/no-go gate:

```bash
node tools/osm-extractor/dist/src/cli.js release-go-no-go \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --published-only
```

Optional explicit scope:

```bash
node tools/osm-extractor/dist/src/cli.js release-go-no-go \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --resort-key CA_Golden_Kicking_Horse \
  --resort-key CA_Fernie_Fernie
```

## Build CLI

```bash
npm --prefix tools/osm-extractor run build
```

Run the compiled CLI from repository root:

```bash
node tools/osm-extractor/dist/src/cli.js --help
```

## Basemap Provider (Menu Option 9)

Menu option `9` can build shared resort basemap assets automatically with provider `openmaptiles-planetiler`.
No manual PMTiles/style prompt is required when provider config is set.

### Prerequisites (Required Before Option 9)

1. Install Java `21+` and verify:

```bash
java -version
```

2. Download Planetiler locally (one-time):

```bash
mkdir -p tools/bin
curl -L https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar \
  -o tools/bin/planetiler.jar
```

3. Verify Planetiler is runnable:

```bash
java -jar tools/bin/planetiler.jar --help
```

4. Use the default provider config (already committed) or customize `planetilerCommand`.
   The default command auto-resolves a Geofabrik `.osm.pbf` by resort country and caches it under:
   - `resorts/.cache/geofabrik/`
   Option `9` fails fast only if `planetilerCommand` is empty.

Default config file:

- `tools/osm-extractor/config/basemap-provider.json`

```json
{
  "provider": "openmaptiles-planetiler",
  "bufferMeters": 1000,
  "maxZoom": 15,
  "planetilerCommand": "java -jar {planetilerJarPath} --osm_path={osmExtractPath} --output={outputPmtiles} --bounds={bboxCsv} --maxzoom={maxZoom} --download=true --download_dir={planetilerDataDir}/sources --tmpdir={planetilerDataDir}/tmp --force=true"
}
```

Required config field:

- `planetilerCommand`
  - shell command template executed locally.
  - it must create:
    - `resorts/<resortKey>/basemap/base.pmtiles`
  - if `style.json` is not produced by command, CLI writes a default offline vector style automatically.
  - supported placeholders:
    - `{resortKey}`
    - `{minLon}` `{minLat}` `{maxLon}` `{maxLat}`
    - `{bboxCsv}`
    - `{bufferMeters}`
    - `{maxZoom}`
    - `{outputPmtiles}`
    - `{outputStyle}`
    - `{boundaryGeojson}`
    - `{osmExtractPath}` (auto-downloaded/cached Geofabrik source extract path)
    - `{planetilerJarPath}` (auto-resolved local Planetiler jar path)
    - `{planetilerDataDir}` (local Planetiler cache dir under `resorts/.cache/planetiler`)

Environment variables used by provider config:

- `PTK_BASEMAP_CONFIG_PATH` (default: `tools/osm-extractor/config/basemap-provider.json`)
- `PTK_PLANETILER_JAR` (optional explicit path to `planetiler.jar`)

Example:

```bash
export PTK_BASEMAP_CONFIG_PATH=tools/osm-extractor/config/basemap-provider.json
export PTK_PLANETILER_JAR=tools/bin/planetiler.jar
```

### First-Run Runtime Expectations

- First run can be slow (often several minutes) because Planetiler downloads provider source datasets.
- Expected cache directories:
  - `resorts/.CACHE/geofabrik/` (regional OSM extracts)
  - `resorts/.CACHE/planetiler/sources/` (provider support datasets)
  - `resorts/.CACHE/planetiler/tile_weights.tsv.gz`
- Warm-cache reruns should be much faster.

### Versioning Policy (Deliverables vs Generation Inputs)

Commit these (deliverables used by the app):
- `resorts/<resortKey>/<version>/**` (including `<version>/basemap/base.pmtiles` + `style.json`)

## Contours (Menu -> Fetch/update other things -> Contours)

Contours are generated automatically from a DEM (OpenTopography) and bundled into the resort pack as vector lines.
The same sync step also generates vector terrain band polygons (hypsometric tint input for the app terrain style).

### Prerequisites

1. OpenTopography API key (required):

```bash
export PTK_OPENTOPO_API_KEY="..."
```

2. `gdal_contour` available (required).

Standard setup (recommended when Homebrew works):

```bash
brew install gdal
```

If Homebrew is unavailable (managed/corporate environment), install QGIS (bundles GDAL tools) and point the CLI at it:

```bash
export PTK_GDAL_CONTOUR_BIN="/Applications/QGIS*.app/Contents/MacOS/gdal_contour"
```

The CLI also auto-detects QGIS on macOS when `PTK_GDAL_CONTOUR_BIN` is not set.
- `public/packs/<resortKey>/**`
- `public/packs/<resortKey>.latest.validated.json`
- `public/resort-packs/index.json`

Do not commit these (generation/cache/tool bootstrap):
- `resorts/.CACHE/**`
- `resorts/.cache/**`
- `resorts/*/v*/.cache/**`
- `resorts/*/basemap/**` (shared working source for generation, non-versioned)
- `data/sources/**`, `data/tmp/**`
- `tools/bin/**`

### Troubleshooting (Option 9)

- `Planetiler jar not found`:
  - install jar in `tools/bin/planetiler.jar` or set `PTK_PLANETILER_JAR`.
- `maxZoom must be <= 15`:
  - set `maxZoom` to `15` or below in `tools/osm-extractor/config/basemap-provider.json`.
- Missing `lake_centerline`/`water_polygons`/`natural_earth`:
  - this is expected only on cold cache; allow first run to complete.
- Long first run with little feedback:
  - watch logs for `download`, `osm_pass1`, `osm_pass2`, and `archive` phases.
- Offline app shows overlays but no basemap:
  - verify generated and published checks passed and files exist in both:
    - `resorts/<resortKey>/<version>/basemap/`
    - `public/packs/<resortKey>/`

## Step-By-Step: Resort Workspace Flow

This is the fastest end-to-end way to use the CLI for one resort.

1. Search resort candidates by name + country:

```bash
node tools/osm-extractor/dist/src/cli.js resort-search \
  --name "Kicking Horse" \
  --country CA
```

2. Select one candidate into a workspace file:

```bash
node tools/osm-extractor/dist/src/cli.js resort-select \
  --workspace ./work/kicking-horse/resort.json \
  --name "Kicking Horse" \
  --country CA \
  --index 1
```

3. Detect and review boundary candidates:

```bash
node tools/osm-extractor/dist/src/cli.js resort-boundary-detect \
  --workspace ./work/kicking-horse/resort.json
```

4. Persist selected boundary:

```bash
node tools/osm-extractor/dist/src/cli.js resort-boundary-set \
  --workspace ./work/kicking-horse/resort.json \
  --index 1
```

5. Sync lifts and runs:

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-lifts \
  --workspace ./work/kicking-horse/resort.json \
  --buffer-meters 50

node tools/osm-extractor/dist/src/cli.js resort-sync-runs \
  --workspace ./work/kicking-horse/resort.json \
  --buffer-meters 50
```

6. Verify readiness:

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-status \
  --workspace ./work/kicking-horse/resort.json
```

7. Use orchestrated updates for incremental refresh:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer runs \
  --buffer-meters 50 \
  --require-complete
```

8. Refresh all layers in one command (`boundary -> lifts -> runs`):

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --index 1 \
  --require-complete
```

9. Preview changes without modifying files:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --dry-run
```

10. For automation, use JSON output:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --index 1 \
  --require-complete \
  --json
```

11. Export latest manually validated immutable version as one bundle:

```bash
node tools/osm-extractor/dist/src/cli.js resort-export-latest \
  --resorts-root ./resorts \
  --resort-key CA_Golden_Kicking_Horse \
  --output ./out/CA_Golden_Kicking_Horse.latest.validated.json
```

## Developer Mode (Command-First)

Use command mode for deterministic scripting/CI.

- Build once:

```bash
npm --prefix tools/osm-extractor run build
```

- Run compiled CLI directly:

```bash
node tools/osm-extractor/dist/src/cli.js --help
```

- Prefer `--json` for machine parsing and CI gates.
- Prefer `--require-complete` on `resort-update` for strict readiness enforcement.

## Command Reference

### validate-pack

Validate an existing pack artifact.

```bash
node tools/osm-extractor/dist/src/cli.js validate-pack --input ./pack.json
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js validate-pack --input ./pack.json --json
```

- Success payload:
  - `ok=true`
  - `resort`
  - `schemaVersion`
- Failure payload (stderr, exit 1):
  - `ok=false`
  - `error.code=PACK_VALIDATION_FAILED`
  - `error.details.issues[]`

### summarize-pack

Summarize a valid pack.

```bash
node tools/osm-extractor/dist/src/cli.js summarize-pack --input ./pack.json
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js summarize-pack --input ./pack.json --json
```

### ingest-osm

Normalize local OSM JSON into extractor source format.

```bash
node tools/osm-extractor/dist/src/cli.js ingest-osm \
  --input ./data/resort.osm.json \
  --output ./out/normalized-source.json \
  --resort-id demo-resort \
  --resort-name "Demo Resort" \
  --boundary-relation-id 12345 \
  --bbox 6.99,44.99,7.01,45.01
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js ingest-osm \
  --input ./data/resort.osm.json \
  --output ./out/normalized-source.json \
  --json
```

JSON success fields:

- `ingestion.resortId`
- `ingestion.resortName`
- `ingestion.counts.runs`
- `ingestion.counts.lifts`
- `ingestion.counts.warnings`
- `ingestion.boundary.present|source|sourceId`

### build-pack

Build validated `pack.json` and extraction report from normalized input.

```bash
node tools/osm-extractor/dist/src/cli.js build-pack \
  --input ./out/normalized-source.json \
  --output ./out/pack.json \
  --report ./out/extraction-report.json \
  --timezone Europe/Rome \
  --pmtiles-path ./basemap/resort.pmtiles \
  --style-path ./basemap/style.json \
  --lift-proximity-meters 90
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js build-pack \
  --input ./out/normalized-source.json \
  --output ./out/pack.json \
  --report ./out/extraction-report.json \
  --timezone Europe/Rome \
  --pmtiles-path ./basemap/resort.pmtiles \
  --style-path ./basemap/style.json \
  --json
```

JSON success fields:

- `build.resortId`
- `build.schemaVersion`
- `build.counts.runs|lifts|towers`
- `build.boundaryGate`
- `build.artifacts.packPath|reportPath`

### Resort Acquisition (Name -> Boundary -> Lifts/Runs)

Use the step-by-step workflow above for this flow. The command reference here documents all supported commands and flags.

### Peaks and Contours (Other Things)

The interactive menu now includes:

- `Fetch/update other things`
  - `Peaks`
  - `Contours`

`Peaks` sync is OSM/Overpass-based (`natural=peak`), and `Contours` sync is DEM-backed (OpenTopography + local `gdal_contour`).

#### Automated Contours (DEM -> Vector -> Pack)

Contour generation is **fully automated day-to-day** in the CLI, but requires one-time local setup:

Prerequisites:

1. OpenTopography API key (free key) exported as:
   - `PTK_OPENTOPO_API_KEY`
2. GDAL installed locally with `gdal_contour` available on PATH
   - macOS (Homebrew): `brew install gdal`

Optional contour env vars:

- `PTK_CONTOUR_DEM_PROVIDER` (default `opentopography`)
- `PTK_OPENTOPO_DATASET` (default `COP30`)
- `PTK_OPENTOPO_GLOBALDEM_URL` (advanced override)
- `PTK_GDAL_CONTOUR_BIN` (default `gdal_contour`)
- `PTK_CONTOUR_USER_AGENT` (advanced override)

Interactive menu flow:

1. Open resort menu
2. Ensure boundary is complete
3. `14. Fetch/update other things`
4. `2. Contours`
5. Provide:
   - contour buffer meters (default `2000`)
   - contour interval meters (default `20`)

The CLI will:

- clone the next immutable resort version
- download DEM for the buffered resort boundary bbox
- run `gdal_contour` for contour lines
- run `gdal_contour -p` for terrain band polygons
- import/normalize contours and terrain bands
- update status and metrics

Command mode (scriptable):

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-contours \
  --workspace ./resorts/CA_Golden_Kicking_Horse/vX/resort.json \
  --buffer-meters 2000 \
  --interval-meters 20
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-contours \
  --workspace ./resorts/CA_Golden_Kicking_Horse/vX/resort.json \
  --buffer-meters 2000 \
  --interval-meters 20 \
  --json
```

Notes:

- Generated contours are bundled vector data (`ResortPack.contours`) and render offline after publish.
- Generated terrain bands are bundled vector data (`ResortPack.terrainBands`) and power vector-only hypsometric tint rendering offline after publish.
- No runtime contour API configuration is required in the app.

### resort-export-latest

Export the latest manually validated immutable version for one resort as a single JSON bundle.

```bash
node tools/osm-extractor/dist/src/cli.js resort-export-latest \
  --resorts-root ./resorts \
  --resort-key CA_Golden_Kicking_Horse \
  --output ./out/CA_Golden_Kicking_Horse.latest.validated.json
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js resort-export-latest \
  --resorts-root ./resorts \
  --resort-key CA_Golden_Kicking_Horse \
  --output ./out/CA_Golden_Kicking_Horse.latest.validated.json \
  --json
```

### resort-publish-latest

Export latest manually validated immutable version and upsert app catalog in one command.

Writes:
- `/packs/<resortKey>.latest.validated.json`
- `/resort-packs/index.json` (upsert by `resortId`)
- `/packs/<resortKey>/base.pmtiles`
- `/packs/<resortKey>/style.json`

Required source files in the selected validated version directory:
- `basemap/base.pmtiles`
- `basemap/style.json`

```bash
node tools/osm-extractor/dist/src/cli.js resort-publish-latest \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --resort-key CA_Golden_Kicking_Horse
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js resort-publish-latest \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --resort-key CA_Golden_Kicking_Horse \
  --json
```

### extract-resort

Run full single-resort pipeline from config.

```bash
node tools/osm-extractor/dist/src/cli.js extract-resort \
  --config ./config/resort.json \
  --log-file ./out/extract-audit.jsonl
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js extract-resort \
  --config ./config/resort.json \
  --json
```

### extract-fleet

Run multi-resort extraction from fleet config.

```bash
node tools/osm-extractor/dist/src/cli.js extract-fleet \
  --config ./config/fleet.json \
  --log-file ./out/fleet-audit.jsonl
```

JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js extract-fleet \
  --config ./config/fleet.json \
  --json
```

## Config Contracts

### extract-resort config (`schemaVersion: 0.4.0`)

```json
{
  "schemaVersion": "0.4.0",
  "resort": {
    "id": "demo-resort",
    "name": "Demo Resort",
    "timezone": "Europe/Rome",
    "boundaryRelationId": 12345
  },
  "source": {
    "osmInputPath": "../data/demo.osm.json",
    "area": {
      "bbox": [6.99, 44.99, 7.01, 45.01]
    }
  },
  "output": {
    "directory": "../out/demo",
    "normalizedFile": "normalized-source.json",
    "packFile": "pack.json",
    "reportFile": "extraction-report.json",
    "provenanceFile": "provenance.json"
  },
  "basemap": {
    "pmtilesPath": "../basemap/demo.pmtiles",
    "stylePath": "../basemap/style.json"
  },
  "thresholds": {
    "liftProximityMeters": 90
  },
  "qa": {
    "allowOutsideBoundary": false
  },
  "determinism": {
    "generatedAt": "2026-02-18T10:00:00.000Z"
  }
}
```

### extract-fleet config (`schemaVersion: 1.0.0`)

```json
{
  "schemaVersion": "1.0.0",
  "output": {
    "manifestPath": "../out/fleet-manifest.json",
    "provenancePath": "../out/fleet-provenance.json"
  },
  "options": {
    "continueOnError": true,
    "generatedAt": "2026-02-18T10:00:00.000Z"
  },
  "resorts": [
    {
      "id": "demo-a",
      "configPath": "./resort-a.json"
    },
    {
      "id": "demo-b",
      "configPath": "./resort-b.json"
    }
  ]
}
```

## Output Artifacts

### Single Resort

Inside configured output directory:

- `normalized-source.json`
- `pack.json`
- `extraction-report.json`
- `provenance.json`

### Fleet

At configured output paths:

- fleet manifest JSON with per-resort status and counts
- fleet provenance JSON with manifest checksum and per-resort artifact references

## JSON Error Envelope (`--json` failures)

On failures in JSON mode, CLI writes a structured payload to stderr and exits with status `1`:

```json
{
  "ok": false,
  "error": {
    "command": "build-pack",
    "code": "MISSING_REQUIRED_FLAGS",
    "message": "Missing required flags. build-pack needs --input --output --report --timezone --pmtiles-path --style-path.",
    "details": {
      "required": ["--input", "--output", "--report", "--timezone", "--pmtiles-path", "--style-path"]
    }
  }
}
```

Known stable error codes:

- `UNKNOWN_COMMAND`
- `MISSING_REQUIRED_FLAGS`
- `INVALID_FLAG_VALUE`
- `INVALID_FLAG_COMBINATION`
- `PACK_VALIDATION_FAILED`
- `RESORT_UPDATE_FAILED`
- `UPDATE_INCOMPLETE`
- `COMMAND_FAILED`

## Troubleshooting

- `No valid boundary candidates with polygon geometry were found`:
  - confirm resort selection identity (`Re-select resort identity` in menu),
  - retry boundary update and prefer higher-score candidates with `containsCenter=yes`.
- Overpass/Nominatim instability or rate-limit symptoms (timeouts/429/503):
  - retry same command (CLI has caching/throttle),
  - reduce concurrent manual runs,
  - run single-layer updates before full `--layer all`.
- `No manually validated version found for resort ...` on export:
  - validate boundary/runs/lifts in menu (`6/7/8`) for latest version,
  - rerun `resort-export-latest`.

- Failure matrix and remediation playbook:
  - `tools/osm-extractor/docs/troubleshooting.md`
- Includes:
  - error-code to fix mapping,
  - boundary/config/schema failure diagnostics,
  - CI parsing and gating examples.

## Data Extraction Playbook

- End-to-end extraction workflow and handoff process:
  - `tools/osm-extractor/docs/data-extraction-playbook.md`
- App import readiness checklist:
  - `tools/osm-extractor/docs/checklists/resort-handoff.md`
- Includes:
  - working directory layout,
  - single-resort and fleet execution flow,
  - mandatory validation gates,
  - app-side pack import verification steps.

## Menu Documentation

- Operator guide:
  - `tools/osm-extractor/docs/menu-user-guide.md`
- Developer architecture and data contracts:
  - `tools/osm-extractor/docs/development/menu-architecture.md`

## Links

- Extractor spec vision: `tools/osm-extractor/spec/vision.md`
- Extractor personas: `tools/osm-extractor/spec/personas.md`
- Extractor use cases: `tools/osm-extractor/spec/use-cases.md`
- Extractor roadmap index: `tools/osm-extractor/spec/roadmap/index.md`
- Extractor troubleshooting: `tools/osm-extractor/docs/troubleshooting.md`
- Extractor data playbook: `tools/osm-extractor/docs/data-extraction-playbook.md`
- Extractor handoff checklist: `tools/osm-extractor/docs/checklists/resort-handoff.md`
- Menu user guide: `tools/osm-extractor/docs/menu-user-guide.md`
- Menu developer architecture: `tools/osm-extractor/docs/development/menu-architecture.md`
