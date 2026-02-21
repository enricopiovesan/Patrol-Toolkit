# v2 Exit Evidence Bundle - 2026-02-21

## Metadata
- Date: 2026-02-21
- Branch: `slice8-docs-runbook-v2-exit-signoff`
- Base commit: `6caf236`
- Reviewer: pending

## Test Commands
- `npm run check`: PASS
- `npm --prefix tools/osm-extractor run -s check`: PASS

## Resort Validation Matrix
| Resort | Boundary | Runs | Lifts | Basemap Generated | Basemap Published | App Online | App Offline |
|---|---|---|---|---|---|---|---|
| CA_Golden_Kicking_Horse | yes | yes | yes | yes | yes | pending manual | pending manual |
| CA_Chelsea_Camp_Fortune | yes | yes | yes | yes | yes | pending manual | pending manual |
| CA_Kimberley_Kimberley_Resort | yes | yes | yes | yes | yes | pending manual | pending manual |
| CA_Beaupre_Mont_Sainte_Anne | yes | yes | yes | yes | yes | pending manual | pending manual |
| CA_Rossland_Red_Mountain_Resort | yes | yes | yes | yes | yes | pending manual | pending manual |
| CA_Whistler_Whistler_Blackcomb | yes | yes | yes | yes | yes | pending manual | pending manual |

## Artifact Sizes
| Resort | base.pmtiles bytes | style.json bytes | pack json bytes |
|---|---|---|---|
| CA_Beaupre_Mont_Sainte_Anne | 599815 | 1096 | 215139 |
| CA_Chelsea_Camp_Fortune | 688788 | 1096 | 59995 |
| CA_Golden_Kicking_Horse | 507606 | 1096 | 138069 |
| CA_Kimberley_Kimberley_Resort | 599289 | 1096 | 166386 |
| CA_Rossland_Red_Mountain_Resort | 597460 | 1096 | 193669 |
| CA_Whistler_Whistler_Blackcomb | 1899951 | 1096 | 1993032 |

## Phrase Samples
| Resort | Sample phrase | Expected context met (Y/N) |
|---|---|---|
| CA_Golden_Kicking_Horse | `Redemption Ridge, bottom section, 100m below Stairway to Heaven tower 7` | Y |
| Other resorts | pending manual capture | pending |

## Screenshots
- Online map render: pending manual capture
- Offline map render: pending manual capture
- Phrase generation example: pending manual capture
- CLI publish confirmation: pending manual capture

## Issues and Resolutions
- None in automated checks.

## Final Signoff
- [ ] v2 accepted for merge
- Notes: complete pending manual online/offline walkthrough and screenshot capture.
