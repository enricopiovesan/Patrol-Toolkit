# OSM Extractor Use Cases

## UC1 - Generate Pack for One Resort
Input: resort query/area config + output folder.
Output: validated `pack.json` and extraction report.
Note: area config can scope extraction to a bbox before pack generation.

## UC2 - Validate Existing Pack Artifact
Input: `pack.json` path.
Output: pass/fail with machine-readable error list including entity references when available.

## UC3 - Summarize Pack for Review
Input: `pack.json` path.
Output: counts (runs/lifts/towers), schema version, resort id/name.

## UC4 - Boundary Gate
Input: extracted geometries + resort boundary.
Output: warning/error when entities are outside boundary.

## UC5 - Fleet Extraction
Input: fleet config referencing multiple resort configs.
Output: per-resort artifacts plus fleet manifest with success/failure accounting.

## UC6 - Audit Trail Export
Input: extraction command with `--log-file`.
Output: JSONL audit trail with stage events and errors for operations troubleshooting.

## UC7 - Provenance Export
Input: successful resort or fleet extraction run.
Output: provenance artifact with source metadata and checksums of generated outputs.

## UC8 - Reproducible Build Replay
Input: same source data, same config, same tool version, optional fixed `generatedAt`.
Output: deterministic report/manifest/provenance timestamps for reproducible CI artifacts.
