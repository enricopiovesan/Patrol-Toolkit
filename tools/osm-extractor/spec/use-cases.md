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
Output: counts (runs/lifts/towers), schema version, resort id/name (text or machine-readable JSON mode).

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

## UC9 - Machine-readable Extraction Result
Input: `extract-resort` or `extract-fleet` command with `--json`.
Output: structured JSON result for CI automation (counts, status, and artifact paths).

## UC10 - Machine-readable Ingest/Build Result
Input: `ingest-osm` or `build-pack` command with `--json`.
Output: structured JSON command result for automation pipelines and machine parsing.

## UC11 - Machine-readable CLI Failure Contract
Input: any CLI command executed with `--json` that fails due to invalid input, flags, or runtime validation.
Output: structured JSON error payload with command, stable code, message, and optional details for CI automation handling.

## UC12 - Resort Discovery By Name And Country
Input: resort name + country filters.
Output: ranked resort candidates with stable identifiers and location metadata for operator selection.

## UC13 - Boundary-First Resort Setup
Input: selected resort candidate.
Output: validated boundary selection persisted before lifts/runs synchronization is allowed.

## UC14 - Layer-Specific Sync
Input: selected resort workspace + one layer (`boundary`, `lifts`, or `runs`).
Output: independent, repeatable layer fetch/sync with status tracking and resumable behavior.

## UC15 - Incremental Resort Refresh After OSM Edits
Input: existing resort workspace + changed OSM upstream data.
Output: partial refresh of affected layers (for example runs-only) without rebuilding unaffected layers.
