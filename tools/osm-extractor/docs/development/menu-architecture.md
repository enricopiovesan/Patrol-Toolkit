# OSM Extractor Menu Architecture (Developer)

This document defines the technical contract for interactive `menu` mode and its persisted data layout.

## Scope

- Adds interactive entry point `menu`.
- Keeps existing non-interactive commands for developer automation.
- Uses immutable resort version folders.
- Persists stable status metrics per version.

## Data Root

Default root path:

```text
./resorts
```

Resort directory key:

```text
CC_Town_Resort_Name
```

Normalization rules:

- ASCII only.
- Replace spaces with `_`.
- Remove punctuation except `_`.
- Preserve country code uppercase.

## Versioning Contract

- Per resort, versions are sequential immutable folders:
  - `v1`, `v2`, ..., `vN`
- No in-place mutation of an existing `vN`.
- New updates always write a new version folder.

## Version File Set

Minimum files in each `vN`:

- `resort.json` (workspace/selection state)
- `boundary.geojson` (when boundary is set)
- `lifts.geojson` (when lifts synced)
- `runs.geojson` (when runs synced)
- `status.json` (stable metrics contract)

## Status JSON Contract

```json
{
  "schemaVersion": "1.0.0",
  "resortKey": "CA_Golden_Kicking_Horse",
  "version": "v2",
  "createdAt": "2026-02-20T12:00:00.000Z",
  "selection": {
    "name": "Kicking Horse",
    "countryCode": "CA",
    "town": "Golden",
    "osmType": "node",
    "osmId": 7248641928
  },
  "layers": {
    "boundary": {
      "status": "complete",
      "featureCount": 1,
      "artifactPath": "boundary.geojson",
      "checksumSha256": "..."
    },
    "lifts": {
      "status": "complete",
      "featureCount": 10,
      "artifactPath": "lifts.geojson",
      "checksumSha256": "..."
    },
    "runs": {
      "status": "complete",
      "featureCount": 22,
      "artifactPath": "runs.geojson",
      "checksumSha256": "..."
    }
  },
  "readiness": {
    "overall": "ready",
    "issues": []
  },
  "manualValidation": {
    "validated": false,
    "validatedAt": null,
    "validatedBy": null,
    "notes": null
  }
}
```

### Notes

- `manualValidation.validated` is operator-owned; CLI does not auto-set `true`.
- `artifactPath` values are version-relative for portability.
- `readiness.overall` is derived from layer readiness checks.

## Menu V1 Interaction Model

- Top-level options:
  - Select known resort.
  - Search/select new resort.
  - Boundary detect/set.
  - Sync lifts.
  - Sync runs.
  - Sync status.
- Known resorts list displays only latest version for each resort key.
- Search flow requires all prompts (`name`, `countryCode`, `town`) before querying.
