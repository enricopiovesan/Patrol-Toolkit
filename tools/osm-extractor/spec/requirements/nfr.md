# OSM Extractor Non Functional Requirements

## P0
- Deterministic output given same input and tool version.
- No network required when extracting from local OSM source files.
- Clear non-zero exit status on extraction/validation failures.

## P1
- Actionable validation messages with entity references.
- Runs in CI without interactive prompts.
- Output includes provenance metadata (source and timestamp).

## P2
- Processing logs suitable for audit and troubleshooting.
