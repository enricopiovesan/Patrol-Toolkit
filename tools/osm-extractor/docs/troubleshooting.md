# OSM Extractor Troubleshooting

This guide maps known failures to root causes and concrete remediation steps.

## Failure Matrix (JSON Mode)

When running with `--json`, failures are emitted on stderr with:

- `error.code`
- `error.message`
- optional `error.details`

### `UNKNOWN_COMMAND`

- Typical cause:
  - Typo in command name.
- Verify:
  - Run `node tools/osm-extractor/dist/src/cli.js --help`.
- Fix:
  - Use one of:
    - `validate-pack`
    - `summarize-pack`
    - `ingest-osm`
    - `build-pack`
    - `extract-resort`
    - `extract-fleet`

### `MISSING_REQUIRED_FLAGS`

- Typical cause:
  - Required command flag omitted.
- Verify:
  - Inspect `error.details.required`.
- Fix:
  - Provide all required flags.
  - Common examples:
    - `validate-pack` requires `--input`.
    - `ingest-osm` requires `--input` and `--output`.
    - `build-pack` requires `--input --output --report --timezone --pmtiles-path --style-path`.
    - `extract-resort` and `extract-fleet` require `--config`.

### `INVALID_FLAG_VALUE`

- Typical cause:
  - Flag value has invalid type or format.
- Verify:
  - Inspect `error.details.flag`, `error.details.expected`, `error.details.value`.
- Fix:
  - `--boundary-relation-id`: provide an integer.
  - `--lift-proximity-meters`: provide a finite number.
  - `--bbox`: provide `minLon,minLat,maxLon,maxLat` with numeric values and `min <= max`.

### `PACK_VALIDATION_FAILED`

- Typical cause:
  - `validate-pack --json` found schema violations.
- Verify:
  - Inspect `error.details.issues[]`.
- Fix:
  - Use issue paths/messages to repair the pack.
  - Re-run:
    - `node tools/osm-extractor/dist/src/cli.js validate-pack --input <pack.json> --json`

### `COMMAND_FAILED`

- Typical cause:
  - Runtime failure outside typed CLI input validation.
- Verify:
  - Check `error.message`.
  - Re-run command without `--json` to get full text context.
  - If using pipeline commands, inspect audit log (`--log-file`) for stage-level failure event.
- Fix:
  - Apply command-specific remediation below.

## Command-Specific Failure Playbook

### Ingestion (`ingest-osm`)

- Symptom:
  - OSM parse/shape failures.
- Likely causes:
  - Input is not valid OSM JSON shape.
  - Broken node/way/relation references.
- Remediation:
  - Validate source file JSON syntax.
  - Confirm it contains valid OSM `elements`.
  - Re-export source with complete geometry references.

### Pack Build (`build-pack`)

- Symptom:
  - Boundary gate failure with non-zero exit.
- Likely causes:
  - Run centerline points or lift towers outside boundary polygon.
- Remediation:
  - Inspect `extraction-report.json` `boundaryGate.issues`.
  - Correct OSM geometry or boundary source.
  - For controlled override workflows only, re-run with `--allow-outside-boundary`.

### Single Resort Pipeline (`extract-resort`)

- Symptom:
  - Config validation error.
- Likely causes:
  - Invalid schema version.
  - Missing required config sections (`resort`, `source`, `output`, `basemap`).
  - Invalid types (for example non-array bbox).
- Remediation:
  - Validate against `schemaVersion: "0.4.0"` contract in README.
  - Fix field names/types.
  - Re-run with `--json` for machine-readable failure handling.

### Fleet Pipeline (`extract-fleet`)

- Symptom:
  - Fleet stop on first failure.
- Likely causes:
  - `options.continueOnError` is false or omitted.
  - Duplicate resort ids.
  - One referenced resort config fails.
- Remediation:
  - For batch processing, set `options.continueOnError: true`.
  - Ensure unique resort ids.
  - Inspect fleet manifest failed entries and fix underlying resort config/data.

## CI Integration Patterns

### Parse JSON failures safely

```bash
set -o pipefail
if ! output=$(node tools/osm-extractor/dist/src/cli.js build-pack \
  --input ./out/normalized-source.json \
  --output ./out/pack.json \
  --report ./out/extraction-report.json \
  --timezone Europe/Rome \
  --pmtiles-path ./basemap/resort.pmtiles \
  --style-path ./basemap/style.json \
  --json 2>&1 >/dev/null); then
  code=$(printf '%s' "$output" | node -e 'const fs=require("fs");const i=JSON.parse(fs.readFileSync(0,"utf8"));console.log(i.error?.code ?? "UNKNOWN")')
  echo "Extractor failed with code: $code"
  exit 1
fi
```

### Enforce validation gate in CI

```bash
node tools/osm-extractor/dist/src/cli.js validate-pack --input ./out/pack.json --json >/tmp/validate.json 2>/tmp/validate.err || {
  echo "Pack validation failed"
  cat /tmp/validate.err
  exit 1
}
```

## Forensic Logging

- Always use `--log-file` for pipeline commands in CI.
- Persist:
  - audit log JSONL
  - extraction report
  - provenance artifacts
  - fleet manifest (for multi-resort runs)
