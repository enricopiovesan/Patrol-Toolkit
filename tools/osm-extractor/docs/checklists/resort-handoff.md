# Resort Pack Handoff Checklist

Complete this checklist for every resort before app import sign-off.

## Run Metadata

- [ ] Resort id recorded.
- [ ] OSM source file path recorded.
- [ ] OSM source file checksum recorded.
- [ ] Extractor commit hash recorded.
- [ ] Extraction timestamp recorded.

## Extraction Execution

- [ ] `extract-resort` completed with exit code `0`.
- [ ] Audit log captured (if `--log-file` used).
- [ ] `pack.json` generated.
- [ ] `extraction-report.json` generated.
- [ ] `provenance.json` generated.

## Quality Gates

- [ ] `validate-pack --input <pack.json>` returns `VALID`.
- [ ] `summarize-pack --json` reviewed for expected run/lift/tower counts.
- [ ] `extraction-report.json` reviewed.
- [ ] `boundaryGate.status` is `passed` or approved with documented rationale.
- [ ] Any warnings are reviewed and accepted.

## App Import Verification

- [ ] `pack.json` imported in Patrol Toolkit app.
- [ ] UI status confirms `Pack imported: <Resort Name>`.
- [ ] Active pack confirms `Active pack: <Resort Name>`.
- [ ] Phrase generation works after import.
- [ ] Removal/re-import cycle tested once.

## Release Bundle

- [ ] Bundle contains `pack.json`, `extraction-report.json`, `provenance.json`.
- [ ] Bundle includes config and audit log references.
- [ ] Reviewer/approver name and date recorded.
