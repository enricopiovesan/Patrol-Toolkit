# v2 Troubleshooting Matrix

| Symptom | Likely Cause | Verify | Fix |
|---|---|---|---|
| App shows `Invalid resort pack ... lifts must NOT have fewer than 1 items` | Resort published while readiness was incomplete | Check resort `status.json` readiness and lifts featureCount | Re-sync/validate lifts, regenerate/publish. Or `Unpublish resort` immediately |
| Boundary update returns wrong nearby place | Weak name match and/or ambiguous locality | Inspect boundary candidates score + distance | Re-run boundary update and provide location hint; keep only local relevant candidate |
| `No valid boundary candidates with polygon geometry` | OSM tags missing for selected object | Review selection display name and local resort context | Retry with optional location hint; re-select resort identity if needed |
| Offline map loads overlays but no basemap | Published basemap artifacts missing/invalid | Check menu metrics `Generated/Published` and artifact checks | Run option 9 mode 1; confirm `base.pmtiles` and `style.json` published |
| Option 9 fails with provider command error | Bad local provider command or missing jar/binary | Read provider command output in CLI | Fix provider command/config, then rerun option 9 |
| Service worker/old cache inconsistency | Stale cache from old build | Confirm SW active and app version changed | Hard refresh, clear site data, reload online once, then retest offline |
