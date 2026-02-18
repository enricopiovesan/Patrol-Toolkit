# OSM Data Extraction Playbook

This playbook defines the repeatable workflow for producing Patrol Toolkit resort artifacts from local OSM JSON and handing them off to the app.

## Scope

Use this playbook when you need to:

- build a new resort pack from local OSM data,
- refresh an existing resort pack after mapping updates,
- generate multi-resort fleet outputs for QA or release review.

## Required Inputs

- local OSM JSON file per resort (`.osm.json`)
- resort metadata:
  - stable resort id
  - resort display name
  - IANA timezone
  - optional boundary relation id
- basemap references:
  - `pmtilesPath`
  - `stylePath`

## Recommended Working Layout

```text
work/
  source/
    resort-a.osm.json
  config/
    resort-a.json
    fleet.json
  out/
    resort-a/
      normalized-source.json
      pack.json
      extraction-report.json
      provenance.json
    fleet/
      fleet-manifest.json
      fleet-provenance.json
  logs/
    resort-a-audit.jsonl
```

## Step 1: Validate Tooling State

From repository root:

```bash
npm --prefix tools/osm-extractor install
npm --prefix tools/osm-extractor run check
npm --prefix tools/osm-extractor run build
```

## Step 2: Prepare Resort Config

Create `work/config/resort-a.json`:

```json
{
  "schemaVersion": "0.4.0",
  "resort": {
    "id": "resort-a",
    "name": "Resort A",
    "timezone": "Europe/Rome"
  },
  "source": {
    "osmInputPath": "../source/resort-a.osm.json"
  },
  "output": {
    "directory": "../out/resort-a"
  },
  "basemap": {
    "pmtilesPath": "../basemap/resort-a.pmtiles",
    "stylePath": "../basemap/style.json"
  },
  "thresholds": {
    "liftProximityMeters": 90
  },
  "qa": {
    "allowOutsideBoundary": false
  }
}
```

If you need scoped extraction, add:

```json
"source": {
  "osmInputPath": "../source/resort-a.osm.json",
  "area": {
    "bbox": [6.99, 44.99, 7.01, 45.01]
  }
}
```

## Step 3: Run Single-Resort Extraction

```bash
node tools/osm-extractor/dist/src/cli.js extract-resort \
  --config work/config/resort-a.json \
  --log-file work/logs/resort-a-audit.jsonl
```

For automation pipelines, use JSON mode:

```bash
node tools/osm-extractor/dist/src/cli.js extract-resort \
  --config work/config/resort-a.json \
  --json
```

## Step 4: Validate Outputs

Mandatory checks:

```bash
node tools/osm-extractor/dist/src/cli.js validate-pack \
  --input work/out/resort-a/pack.json

node tools/osm-extractor/dist/src/cli.js summarize-pack \
  --input work/out/resort-a/pack.json \
  --json
```

Review extraction report gate status:

- `work/out/resort-a/extraction-report.json` -> `boundaryGate.status`
- If `failed`, resolve geometry/boundary issues before handoff.

## Step 5: Fleet Extraction (Optional)

Create `work/config/fleet.json`:

```json
{
  "schemaVersion": "1.0.0",
  "output": {
    "manifestPath": "../out/fleet/fleet-manifest.json",
    "provenancePath": "../out/fleet/fleet-provenance.json"
  },
  "options": {
    "continueOnError": true
  },
  "resorts": [
    {
      "id": "resort-a",
      "configPath": "./resort-a.json"
    }
  ]
}
```

Run:

```bash
node tools/osm-extractor/dist/src/cli.js extract-fleet \
  --config work/config/fleet.json \
  --log-file work/logs/fleet-audit.jsonl
```

## Step 6: App Handoff Checklist

Use `tools/osm-extractor/docs/checklists/resort-handoff.md` and complete every item before requesting field validation.

Minimum required handoff bundle per resort:

- `pack.json`
- `extraction-report.json`
- `provenance.json`
- extraction audit log (`.jsonl`) when available

## Step 7: Import Into Patrol Toolkit App

In app UI:

1. Open Patrol Toolkit in browser.
2. In the pack management panel, choose `pack.json` with file input.
3. Confirm status line shows `Pack imported: <Resort Name>`.
4. Confirm active pack line shows `Active pack: <Resort Name>`.
5. Generate one phrase from current GPS (or test position) to verify runtime behavior.

If import fails, the status line includes a validation code/path message. Resolve the pack issue, rebuild, and retry import.

## Step 8: Archive For Traceability

For each extraction run archive:

- source OSM input file hash,
- config file used,
- output artifacts,
- audit log,
- extraction date/time and tool commit hash.

This keeps releases reproducible and reviewable.
