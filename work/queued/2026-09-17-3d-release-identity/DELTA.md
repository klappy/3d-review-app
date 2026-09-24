# DELTA — driver's-seat lens, 2026-09-17-3d-release-identity

Lens run 2026-09-17 06:5xZ by the cos door (planning seat), version 1.0.0. Plan revisions: #16 c5709788310 → c5709825639 → c5709952532 → c5710115073 → c5710298093 (accepted c5710305094).

## Future operator's use
Klappy opens the app, sees "Version 0.1.0", clicks it, reads what changed and which cookbook record and commit it came from. A reviewer six weeks later reads `release/release-manifest.json` and can prove, with two git commands against the cookbook, that the manifest is the immutable record it claims. A production hotfix bumps PATCH in the record first, then the app.

## What the lens changed (delta vs the first draft)
1. Version authority moved from `package.json` to the cookbook release record at an immutable commit; `package.json` became a validated consumer (steering c5709713415).
2. Tracked generated stamp + "local" tolerance removed — git-ignored file, hooks on `pretypecheck`/`pretest`/`predev`, no CI fallback sha (independent review C-1).
3. `src/mcp.ts` `serverInfo.version` added to custody and test (I-8).
4. `[Unreleased]`-in-dev badge rule dropped; `status` field defined as build-time fact from the pinned record; tag step = `git tag` + cookbook C2 (root), no status treadmill (root c5709827067, Auditor B-1).
5. Machine history `releases.json` pinned with blob id + sha256 like the Markdown record; `/changelog.json` generated from the pinned copy (root c5709827067).
6. Independent immutable-blob verification named as a PR-review gate with a receipt before merge (Auditor B-3).
7. 18-J dropped; `18-H-infra.md` is the cookbook home (review finding 8).

## Alternatives considered and rejected
- Runtime env var for the commit — build vars are not available at runtime (Cloudflare docs).
- `git describe`/tags at build — clone depth undocumented.
- App-authored `CHANGELOG.md` — second authority.
- New `/v2/version` capability — new surface; health carries it.
- Trigger build-command change as a prerequisite — hooks make the PR self-sufficient; root inspected the trigger env (no overrides).

## Falsifiers
First CI build: stamp missing → typecheck fails (loud). Health `commit` ≠ merged main SHA → readback fails. Manifest `blob_sha` ≠ `git rev-parse <commit>:<path>` → review gate fails. Any `released` shown for the running version before C2 → UI/test defect.

## Post-lens challenge
`oddkit_challenge` (planning, knowledge_base, 06:04:56Z, block=false): evidence, confidence, alternatives, reversibility, success criteria answered in the plan; 6B row: SemVer + Keep-a-Changelog inspected-and-adopted. Independent plan review: CHANGES REQUIRED → folded → PASS; Auditor: AMEND (5) → folded → ACCEPT-FOR-FIRE.
