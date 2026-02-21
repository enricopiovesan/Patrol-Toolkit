# v2 Exit Evidence Bundle - 2026-02-21

## Metadata
- Date: 2026-02-21
- Branch: `slice8-docs-runbook-v2-exit-signoff`
- Base commit: `6caf236`
- Reviewer: Enrico

## Test Commands
- `npm run check`: PASS
- `npm --prefix tools/osm-extractor run -s check`: PASS

## Resort Validation Matrix
| Resort | Boundary | Runs | Lifts | Basemap Generated | Basemap Published | App Online | App Offline |
|---|---|---|---|---|---|---|---|
| CA_Golden_Kicking_Horse | yes | yes | yes | yes | yes | yes | yes |
| CA_Chelsea_Camp_Fortune | yes | yes | yes | yes | yes | yes | yes |
| CA_Kimberley_Kimberley_Resort | yes | yes | yes | yes | yes | yes | yes |
| CA_Beaupre_Mont_Sainte_Anne | yes | yes | yes | yes | yes | yes | yes |
| CA_Rossland_Red_Mountain_Resort | yes | yes | yes | yes | yes | yes | yes |
| CA_Whistler_Whistler_Blackcomb | yes | yes | yes | yes | yes | yes | yes |

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
| Other resorts | Representative phrase checks completed during manual signoff | Y |

## Screenshots
- Online map render: captured and verified.
- Offline map render: captured and verified.
- Phrase generation example: captured and verified.
- CLI publish confirmation: captured and verified.

## Issues and Resolutions
- None in automated checks.

## Final Signoff
- [x] v2 accepted for merge
- Notes: clean-machine walkthrough completed from docs, final app online/offline signoff completed, and screenshot/evidence checklist closed.
