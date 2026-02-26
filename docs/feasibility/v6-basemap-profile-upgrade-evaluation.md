## v6 Basemap Profile Upgrade Evaluation (Slice 13)

### Decision

No Planetiler/OpenMapTiles profile upgrade is required for v6.

### Why no change is needed

The v6 context-layer goals were validated using the current `openmaptiles-planetiler` output plus style augmentation:

- `building` layer is present and renders building footprints.
- `landcover` layer includes woodland/wood classes and renders trees/forest context.
- `water` and `waterway` layers are present and render lakes/rivers/streams.
- `water_name` data is available in some tiles/zooms, with graceful fallback to `waterway` labels.
- `poi` includes food amenities (for example `Eagle's Eye` at Kicking Horse) and is now rendered via strict POI filtering.

These capabilities were shipped in v6 Slices 4-6 without changing the basemap generation profile itself.

### What changed instead (and why)

The required improvements were solved at the style augmentation layer in the CLI publish/generation flow:

- fallback generated `style.json` gets added context layers (trees, buildings, water features, water labels, restaurant POIs)
- provider-generated `style.json` also gets the same augmentation, avoiding drift between fallback and provider outputs

This approach keeps the offline basemap workflow stable and avoids unnecessary PMTiles/profile churn.

### Measurable implications

#### Basemap generation workflow

- No new provider command arguments required
- No new provider dependencies
- No change to `PTK_BASEMAP_*` configuration
- No change to CLI option `9` UX

#### Artifact size/time/coverage

- PMTiles generation size/time is unchanged by this slice because the profile is unchanged.
- Published `style.json` grows modestly due to additional style layers only.
- Feature coverage remains bounded by the current OpenMapTiles/Planetiler data for the selected extract and zooms.

### Risks / known limitations (accepted for v6)

- Some lakes may still have no labels at a given tile/zoom if `water_name` is absent in source tiles.
- Some buildings/POIs may be missing in OSM data for a resort area.
- Terrain quality improvements (hypsometric tint, faux shading) are handled via resort overlays, not profile changes.

### Trigger for revisiting this decision (future roadmap)

Re-open a basemap profile upgrade only if one of these becomes true:

- a required context layer is consistently missing from current tiles across resorts
- POI classification is too sparse/inconsistent for operational needs
- a future terrain/context feature requires source-layer data not present in current output
- generation performance/size tradeoffs justify a custom profile

