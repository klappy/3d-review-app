# APP METADATA RECEIPT — 0.16.0 candidate (Fable release worker, K3a)
Observed clock (oddkit_time): continuation order read 15:49:16Z (actual START); commit + push + PR by 15:51Z; this receipt 15:51:04Z. Release preparation only — NOT merged, NOT deployed, NOT tagged.

## Immutable canonical chain verified (this worker, local git)
- cookbook PR102 merged: merge commit **20d51447e0d923f05a9b83f7e421241eec1ccf40**, parents ac10348b (prior main) + 5a40b92d (my head); cookbook main == 20d51447 at read.
- `git rev-parse 20d51447:planning/2026-09-16-parity-build/releases/0.16.0.md` = a0f0173c9ed6f2492c308e6abb3cce71b099efe5, sha256 9627aa8c4eb84333d8f93e52e9bf01d72df3d0ffc77c0440980aa168fd42197e.
- `…/releases.json` = 5e64407771fb8360af4ff1f279d95a9581b1958e, sha256 7081441b22a824d399dfe7c65d76fb4459e6d3625d8b04c207f93853ec030e35.
- Both merged blobs byte-identical to the files I authored (cmp). Drift check: PR171 head still c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822, open; no prior `release/k3a*` ref existed.

## App candidate
- Branch `release/k3a-0.16.0-20260922` from exact c9bf2b1; one commit **907bd5d2b8056e669e7e3972db395b704612f748**, tree 3174541bf406c808ce5c1f692fcdea558723111d, author/committer klappy no-reply. Pushed; remote ref read back = 907bd5d2.
- PR **klappy/3d-review-app#174** https://github.com/klappy/3d-review-app/pull/174 — draft, head 907bd5d2 → main (base 9f2e4b44), assigned klappy, no review requested. Opened with existing scoped GitAuth `pull_requests:write`.
- `git diff --stat c9bf2b1..907bd5d2`: 6 files, +89/−28; paths outside the six = **0**. release/cookbook/0.16.0.md and releases.json `git hash-object` = pin blobs a0f0173c / 5e644077 (byte copies). release-manifest: version 0.16.0, cookbook_commit 20d51447, two records with the blob/sha256 above, changelog.sections = pinned 0.16.0 json entry. package.json version only; package-lock root + packages[""] only (lines 3 and 9). test/version-stamp.test.ts: 12 literal replacements 0.14.5→0.16.0, no logic or fixture change (diff in PR).

## Observed checks at 907bd5d2 (worker, sandbox clone; mounted tree refused index.lock unlink so the declared sandbox fallback was used; evidence mirrored to worker-release-k3a/evidence/)
- `npm run stamp` → `stamp-version: 0.16.0+c9bf2b1 (release_source 20d5144)` (commit is the checked-out source sha; CI stamps its own).
- `npx vitest run test/version-stamp.test.ts` → 16 passed / 0 failed.
- `npm run typecheck` (pretypecheck stamp → unchanged) → tsc exit 0.
- Generated src/version.generated.ts and ui/changelog.json remain git-ignored (`!!`); derived changelog.json head = 0.16.0 candidate, no tag/date. No full-suite, build, DEV or provider claim.

## Remaining gates (named, not closed)
Independent exact-head review of #174; Cursor Bugbot App 1210556 SUCCESS + every attached check; candidate-specific issue14/cargo hold disposition with the existing control record; then ordinary guarded merge → observed DEV push-event build/version/deployment and root desktop/phone journey → separate same-version/same-pin production PR with actual Bugbot comment-only configuration evidence and independent review. No exception from167/169. Variance: 15:48Z production target passed while canonical merge/checks were running (observed 15:49Z at continuation); recorded, not skipped. Owner remains available for correction on this branch.
