# v3 Release Runbook (GitHub-only)

## Scope
This runbook defines the production release process for the v3 program using only GitHub/GitHub Pages artifacts.

Use this for:
- release candidate validation
- go/no-go decision
- publish and rollback execution

## Preconditions
- Branches merged and `main` is the release source.
- Local quality gates pass:
  - `npm run check`
  - `npm --prefix tools/osm-extractor run check`
- Resort scope is decided.
  - preferred: published set only (`--published-only`)
  - optional: explicit scope via repeated `--resort-key`

## Release Preflight (Required)
From repository root:

```bash
npm run check
npm --prefix tools/osm-extractor run check
npm --prefix tools/osm-extractor run build
```

Run scoped release dry-run:

```bash
node tools/osm-extractor/dist/src/cli.js release-dry-run \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --published-only
```

Expected:
- `RELEASE_DRY_RUN ... ok=true`
- no `GLOBAL_FAIL`, `MANIFEST_FAIL`, `FAIL`, or `AUDIT_FAIL` lines

Optional JSON output (for CI/evidence):

```bash
node tools/osm-extractor/dist/src/cli.js release-dry-run \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --published-only \
  --json
```

## Go/No-Go Gate (Required)
Run the dedicated gate command:

```bash
node tools/osm-extractor/dist/src/cli.js release-go-no-go \
  --resorts-root ./resorts \
  --app-public-root ./public \
  --published-only
```

Gate is `GO` only if:
- every scoped resort is latest `ready + manually validated + published`
- published artifact integrity is clean
- `public/releases/stable-manifest.json` checksum matches catalog `release.manifestSha256`

If `ok=false`, do not release. Fix reported failures first.

## Tag + GitHub Release
After gate is green:

1. Create release commit(s) on `main` if needed.
2. Create annotated tag:

```bash
git tag -a v1.0.0 -m "Patrol Toolkit v1.0.0"
git push origin v1.0.0
```

3. Create GitHub Release for the tag and attach evidence links.

## Post-Deploy Smoke Checks (Required)
Validate stable production URL:
- app shell loads online
- install flow available in Settings/Help
- app update check works
- pack update check works
- selected resort basemap + overlays render online
- offline reload works after warm cache

## Rollback Trigger Criteria
Rollback immediately if any occurs post-deploy:
- release gate mismatch in production artifacts
- stable manifest/catalog checksum mismatch
- blocking failures in install/update flow
- offline regression for previously working resorts

## Rollback Procedure
1. Identify last known-good release tag.
2. Restore release artifacts/catalog state to last known-good.
3. Republish stable URL from known-good release source.
4. Re-run smoke checks on restored state.
5. Open incident note with root cause and corrective actions.

## Evidence to Capture
- `release-dry-run --json` output
- `release-go-no-go --json` output
- release tag and GitHub Release URL
- smoke-check screenshots/log snippets
- rollback evidence (if rollback executed)
