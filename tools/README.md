# Tools Workspace

This folder contains build and data tooling used by Patrol Toolkit.

## Current Tools

- `osm-extractor`: offline CLI that converts local OSM JSON into Patrol Toolkit resort/fleet artifacts.

## Documentation Plan

### Objective
Provide operator-grade documentation so a new maintainer can run, validate, troubleshoot, and automate tool workflows without reading source code first.

### PR d1 - Tools Index And Runbook Entry
- Add this index for tool discovery and ownership.
- Link each tool to its primary runbook.
- Define shared conventions: deterministic outputs, offline requirement, CI-friendly commands.

### PR d2 - OSM Extractor Operator README
- Document installation and quality gate commands.
- Document every CLI command and JSON mode contracts.
- Document single-resort and fleet workflows with real command examples.
- Document expected output artifacts (`pack`, `report`, `manifest`, `provenance`, logs).

### PR d3 - Troubleshooting And Failure Taxonomy
- Add failure playbook by stable error code.
- Add remediation steps for config, boundary gate, and schema failures.
- Add CI integration examples for machine-readable success/failure handling.
- Status: implemented in `tools/osm-extractor/docs/troubleshooting.md`.

### PR d4 - Data Extraction Playbook Integration
- Connect extractor docs with OSM data sourcing workflow.
- Add repeatable handoff checklist from extracted artifacts to app import.
- Status: implemented in `tools/osm-extractor/docs/data-extraction-playbook.md` and `tools/osm-extractor/docs/checklists/resort-handoff.md`.

## Shared Standards

- No network dependency during extraction from local OSM files.
- Deterministic output for same input/config/tool version.
- Machine-readable output for CI via `--json`.
- Non-zero exit code on failures.
