# OSM Extractor Vision

## Purpose
Transform OpenStreetMap resort data into deterministic Patrol Toolkit Resort Packs.

## Product Role
The extractor is a data engineering CLI that produces portable, validated pack artifacts consumed by the Patrol Toolkit app. It supports both local-source extraction and staged resort acquisition workflows.

## Success Outcome
A patrol team can discover/select a resort, stage boundary/lift/run synchronization, and obtain a validated pack containing:
- resort boundary,
- runs and centerlines,
- lifts and tower references,
- style/tiles references,
with deterministic output quality and traceable provenance.
