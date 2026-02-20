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
- `9` to generate offline basemap assets for the current version using a local provider command (defaults: buffer `1000m`, max zoom `16`).
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

Default config file:

- `tools/osm-extractor/config/basemap-provider.json`

```json
{
  "provider": "openmaptiles-planetiler",
  "bufferMeters": 1000,
  "maxZoom": 16,
  "planetilerCommand": "REPLACE_WITH_LOCAL_PLANETILER_COMMAND"
}
```

Required config field:

- `planetilerCommand`
  - shell command template executed locally.
  - it must create:
    - `resorts/<resortKey>/basemap/base.pmtiles`
    - `resorts/<resortKey>/basemap/style.json`
  - supported placeholders:
    - `{resortKey}`
    - `{minLon}` `{minLat}` `{maxLon}` `{maxLat}`
    - `{bboxCsv}`
    - `{bufferMeters}`
    - `{maxZoom}`
    - `{outputPmtiles}`
    - `{outputStyle}`
    - `{boundaryGeojson}`

Optional env var overrides:

- `PTK_BASEMAP_PROVIDER` (default: `openmaptiles-planetiler`)
- `PTK_BASEMAP_BUFFER_METERS` (default: `1000`)
- `PTK_BASEMAP_MAX_ZOOM` (default: `16`)
- `PTK_BASEMAP_PLANETILER_CMD`
- `PTK_BASEMAP_CONFIG_PATH` (default: `tools/osm-extractor/config/basemap-provider.json`)

Example:

```bash
export PTK_BASEMAP_PROVIDER=openmaptiles-planetiler
export PTK_BASEMAP_BUFFER_METERS=1000
export PTK_BASEMAP_MAX_ZOOM=16
export PTK_BASEMAP_PLANETILER_CMD="planetiler-wrapper \
  --boundary {boundaryGeojson} \
  --bbox {bboxCsv} \
  --max-zoom {maxZoom} \
  --out {outputPmtiles} \
  --style-out {outputStyle}"
```

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
