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

## Install

```bash
npm --prefix tools/osm-extractor install
```

## Quick Start

Install dependencies:

```bash
npm --prefix tools/osm-extractor install
```

Open the CLI menu with all commands and flags:

```bash
npm --prefix tools/osm-extractor run run:menu
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

Search candidates by resort name and country:

```bash
node tools/osm-extractor/dist/src/cli.js resort-search \
  --name "Kicking Horse" \
  --country CA
```

Select one candidate into a workspace:

```bash
node tools/osm-extractor/dist/src/cli.js resort-select \
  --workspace ./work/kicking-horse/resort.json \
  --name "Kicking Horse" \
  --country CA \
  --index 1
```

Detect boundary candidates:

```bash
node tools/osm-extractor/dist/src/cli.js resort-boundary-detect \
  --workspace ./work/kicking-horse/resort.json
```

Set the boundary:

```bash
node tools/osm-extractor/dist/src/cli.js resort-boundary-set \
  --workspace ./work/kicking-horse/resort.json \
  --index 1
```

Sync lifts or runs independently:

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-lifts \
  --workspace ./work/kicking-horse/resort.json \
  --buffer-meters 50

node tools/osm-extractor/dist/src/cli.js resort-sync-runs \
  --workspace ./work/kicking-horse/resort.json \
  --buffer-meters 50
```

Check workspace sync readiness:

```bash
node tools/osm-extractor/dist/src/cli.js resort-sync-status \
  --workspace ./work/kicking-horse/resort.json
```

Update one layer through the orchestration command:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer runs \
  --buffer-meters 50 \
  --require-complete
```

Update all layers in order (`boundary -> lifts -> runs`):

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --index 1 \
  --require-complete
```

Preview without mutating artifacts/workspace:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --dry-run
```

JSON mode for automation:

```bash
node tools/osm-extractor/dist/src/cli.js resort-update \
  --workspace ./work/kicking-horse/resort.json \
  --layer all \
  --index 1 \
  --require-complete \
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

## Links

- Extractor spec vision: `tools/osm-extractor/spec/vision.md`
- Extractor personas: `tools/osm-extractor/spec/personas.md`
- Extractor use cases: `tools/osm-extractor/spec/use-cases.md`
- Extractor roadmap index: `tools/osm-extractor/spec/roadmap/index.md`
- Extractor troubleshooting: `tools/osm-extractor/docs/troubleshooting.md`
- Extractor data playbook: `tools/osm-extractor/docs/data-extraction-playbook.md`
- Extractor handoff checklist: `tools/osm-extractor/docs/checklists/resort-handoff.md`
