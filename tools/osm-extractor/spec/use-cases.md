# OSM Extractor Use Cases

## UC1 - Generate Pack for One Resort
Input: resort query/area config + output folder.
Output: validated `pack.json` and extraction report.

## UC2 - Validate Existing Pack Artifact
Input: `pack.json` path.
Output: pass/fail with machine-readable error list.

## UC3 - Summarize Pack for Review
Input: `pack.json` path.
Output: counts (runs/lifts/towers), schema version, resort id/name.

## UC4 - Boundary Gate
Input: extracted geometries + resort boundary.
Output: warning/error when entities are outside boundary.
