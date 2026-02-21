# v2 Upgrade Notes

## Summary
v2 consolidates offline resort operations, map readability, and publish integrity.

## Notable Changes
- Phrase generation now favors objective, distance-based anchors.
- Runs render as lines with difficulty color mapping.
- Run labels tuned for readability by zoom.
- Basemap generation supports generate/publish, dry-run, and force rebuild modes.
- Publish safety gate requires both manual validation and readiness `ready`.
- CLI adds `Unpublish resort` to remove bad published assets without deleting resort source data.

## Operator Impact
- Existing workflows remain valid, but publishing is stricter by design.
- Incomplete resorts (for example no lifts) will not publish.

## Upgrade Validation
- Run `npm run check`.
- Verify one known-good resort end-to-end (CLI + app online/offline).
- Verify one rollback path using `Unpublish resort`.
