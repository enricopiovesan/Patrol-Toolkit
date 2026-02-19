# OSM Extractor Non Functional Requirements

## P0
- Deterministic output given same input and tool version.
- No network required when extracting from local OSM source files.
- Clear non-zero exit status on extraction/validation failures.

## P1
- Actionable validation messages with entity references.
- Runs in CI without interactive prompts.
- Output includes provenance metadata (source and timestamp).
- If network-backed acquisition is used, requests must be rate-limit-safe (throttle, retry, and failure visibility).
- Interactive mode must preserve deterministic storage layout and not hide operational failures.

## P2
- Processing logs suitable for audit and troubleshooting.
- Resort version folders are immutable once created (`vN` cannot be overwritten in place).
- Resort root naming follows normalized ASCII convention `CC_Town_Resort_Name`.
- Every resort version contains a machine-readable `status.json` with stable field names.
